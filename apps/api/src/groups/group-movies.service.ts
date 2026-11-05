import { Injectable } from '@nestjs/common';
import { and, arrayOverlaps, asc, desc, eq, ilike, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { offsetOf, type Paginated, paginated } from '../common/dto/pagination.dto.js';
import { conflict, forbidden, notFound } from '../common/errors.js';
import { todayIsoDate } from '../common/utils/dates.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { isUniqueViolation } from '../database/pg-errors.js';
import {
  comments,
  groupMembers,
  groupMovieRatings,
  groupMovies,
  movies,
  userMovies,
} from '../database/schema/index.js';
import { MovieStore } from '../movies/movie-store.service.js';
import { MoviePresenter } from '../movies/movie.presenter.js';
import type { MovieRow } from '../movies/movie.types.js';
import { descNullsLast, likePattern } from '../movies/sql-helpers.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type {
  AddGroupMovieDto,
  GroupMovieFiltersDto,
  GroupMovieSort,
  ListGroupMoviesQueryDto,
  RateGroupMovieDto,
  UpdateGroupMovieDto,
} from './dto/groups.dto.js';
import { GroupAccessService, hasRole } from './group-access.service.js';
import type { GroupMovieDetails, GroupMovieMemberStatus, GroupMovieView } from './groups.types.js';
import { UserDirectoryService } from './user-directory.service.js';

type GroupMovieRow = typeof groupMovies.$inferSelect;

interface Row {
  entry: GroupMovieRow;
  movie: MovieRow;
  ratingAverage: number | null;
  ratingCount: number;
  myRating: number | null;
}

/** The group's shared catalog, shared ratings and per-member viewing status. */
@Injectable()
export class GroupMoviesService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly access: GroupAccessService,
    private readonly directory: UserDirectoryService,
    private readonly store: MovieStore,
    private readonly presenter: MoviePresenter,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    groupId: string,
    userId: string,
    query: ListGroupMoviesQueryDto,
  ): Promise<Paginated<GroupMovieView>> {
    await this.access.require(groupId, userId, { allowArchived: true });
    const rows = await this.select(userId)
      .where(and(...this.conditions(groupId, query)))
      .orderBy(...this.order(query.sort ?? 'added_desc'), asc(movies.tmdbId))
      .limit(query.pageSize)
      .offset(offsetOf(query.page, query.pageSize));
    return paginated(
      await this.toViews(groupId, rows),
      rows[0]?.total ?? 0,
      query.page,
      query.pageSize,
    );
  }

  /** Random pick from the shared catalog (defaults to movies the group still wants to watch). */
  async random(
    groupId: string,
    userId: string,
    filters: GroupMovieFiltersDto,
  ): Promise<GroupMovieView> {
    await this.access.require(groupId, userId, { allowArchived: true });
    const [row] = await this.select(userId)
      .where(
        and(...this.conditions(groupId, { ...filters, status: filters.status ?? 'want_to_watch' })),
      )
      .orderBy(sql`random()`)
      .limit(1);
    if (!row)
      throw notFound('NO_MATCHING_MOVIES', 'No movie in the shared catalog matches these filters.');
    return (await this.toViews(groupId, [row]))[0]!;
  }

  async get(groupId: string, userId: string, tmdbId: number): Promise<GroupMovieDetails> {
    await this.access.require(groupId, userId, { allowArchived: true });
    const [row] = await this.select(userId).where(
      and(eq(groupMovies.groupId, groupId), eq(movies.tmdbId, tmdbId)),
    );
    if (!row) throw notFound('GROUP_MOVIE_NOT_FOUND', 'This movie is not in the shared catalog.');
    const [view] = await this.toViews(groupId, [row]);
    const ratings = await this.db
      .select()
      .from(groupMovieRatings)
      .where(
        and(
          eq(groupMovieRatings.groupId, groupId),
          eq(groupMovieRatings.movieId, row.entry.movieId),
        ),
      )
      .orderBy(desc(groupMovieRatings.updatedAt));
    const people = await this.directory.people(ratings.map((r) => r.userId));
    const [commentCount] = await this.db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(comments)
      .where(and(eq(comments.groupId, groupId), eq(comments.movieId, row.entry.movieId)));
    return {
      ...view!,
      ratings: ratings.map((r) => ({
        user: people.get(r.userId) ?? {
          id: r.userId,
          displayName: 'Former member',
          username: null,
          avatarUrl: null,
        },
        rating: r.rating,
        review: r.review,
        containsSpoilers: r.containsSpoilers,
        updatedAt: r.updatedAt,
      })),
      commentCount: commentCount?.value ?? 0,
    };
  }

  async add(groupId: string, userId: string, dto: AddGroupMovieDto): Promise<GroupMovieDetails> {
    const membership = await this.access.require(groupId, userId);
    const movie = await this.store.ensure(dto.tmdbId);
    try {
      await this.db
        .insert(groupMovies)
        .values({ groupId, movieId: movie.id, note: dto.note ?? null, addedBy: userId });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict('ALREADY_IN_GROUP_CATALOG', 'This movie is already in the shared catalog.');
      }
      throw error;
    }
    await this.notifications.notify({
      recipientIds: await this.access.memberIds(groupId),
      actorId: userId,
      type: 'group_movie_added',
      title: `${await this.directory.displayNameOf(userId)} added ${movie.title} to ${membership.groupName}`,
      data: { groupId, tmdbId: movie.tmdbId },
    });
    return this.get(groupId, userId, dto.tmdbId);
  }

  async update(
    groupId: string,
    userId: string,
    tmdbId: number,
    dto: UpdateGroupMovieDto,
  ): Promise<GroupMovieDetails> {
    await this.access.require(groupId, userId);
    const entry = await this.entry(groupId, tmdbId);
    const status = dto.status ?? entry.status;
    let watchedOn = dto.watchedOn !== undefined ? dto.watchedOn : entry.watchedOn;
    if (status === 'watched' && !watchedOn) watchedOn = todayIsoDate();
    if (status === 'want_to_watch') watchedOn = null;
    await this.db
      .update(groupMovies)
      .set({ status, watchedOn, ...(dto.note !== undefined ? { note: dto.note } : {}) })
      .where(and(eq(groupMovies.groupId, groupId), eq(groupMovies.movieId, entry.movieId)));
    return this.get(groupId, userId, tmdbId);
  }

  /** The member who added the movie, admins and the owner can remove it. */
  async remove(groupId: string, userId: string, tmdbId: number): Promise<void> {
    const membership = await this.access.require(groupId, userId);
    const entry = await this.entry(groupId, tmdbId);
    if (entry.addedBy !== userId && !hasRole(membership.role, 'admin')) {
      throw forbidden(
        'GROUP_PERMISSION_DENIED',
        'Only the member who added it or an admin can remove it.',
      );
    }
    await this.db
      .delete(groupMovies)
      .where(and(eq(groupMovies.groupId, groupId), eq(groupMovies.movieId, entry.movieId)));
  }

  /** Shares a rating (and optional short review) with the group. Separate from personal ratings. */
  async rate(
    groupId: string,
    userId: string,
    tmdbId: number,
    dto: RateGroupMovieDto,
  ): Promise<GroupMovieDetails> {
    const membership = await this.access.require(groupId, userId);
    const entry = await this.entry(groupId, tmdbId);
    const values = {
      rating: dto.rating,
      review: dto.review ?? null,
      containsSpoilers: dto.containsSpoilers ?? false,
    };
    await this.db
      .insert(groupMovieRatings)
      .values({ groupId, movieId: entry.movieId, userId, ...values })
      .onConflictDoUpdate({
        target: [groupMovieRatings.groupId, groupMovieRatings.movieId, groupMovieRatings.userId],
        set: values,
      });
    const [movie] = await this.db
      .select({ title: movies.title })
      .from(movies)
      .where(eq(movies.id, entry.movieId));
    await this.notifications.notify({
      recipientIds: await this.access.memberIds(groupId),
      actorId: userId,
      type: 'group_movie_rated',
      title: `${await this.directory.displayNameOf(userId)} rated ${movie?.title ?? 'a movie'} ${dto.rating}/10 in ${membership.groupName}`,
      data: { groupId, tmdbId, rating: dto.rating },
    });
    return this.get(groupId, userId, tmdbId);
  }

  async removeRating(groupId: string, userId: string, tmdbId: number): Promise<void> {
    await this.access.require(groupId, userId);
    const entry = await this.entry(groupId, tmdbId);
    const deleted = await this.db
      .delete(groupMovieRatings)
      .where(
        and(
          eq(groupMovieRatings.groupId, groupId),
          eq(groupMovieRatings.movieId, entry.movieId),
          eq(groupMovieRatings.userId, userId),
        ),
      )
      .returning({ userId: groupMovieRatings.userId });
    if (deleted.length === 0)
      throw notFound('RATING_NOT_FOUND', 'You have not rated this movie in the group.');
  }

  /** The shared-catalog row for a movie, or 404. */
  async entry(groupId: string, tmdbId: number): Promise<GroupMovieRow> {
    const [row] = await this.db
      .select({ entry: groupMovies })
      .from(groupMovies)
      .innerJoin(movies, eq(movies.id, groupMovies.movieId))
      .where(and(eq(groupMovies.groupId, groupId), eq(movies.tmdbId, tmdbId)));
    if (!row) throw notFound('GROUP_MOVIE_NOT_FOUND', 'This movie is not in the shared catalog.');
    return row.entry;
  }

  /** Personal status of every member for the given movies. */
  async memberStatuses(
    groupId: string,
    movieIds: string[],
  ): Promise<Map<string, GroupMovieMemberStatus[]>> {
    const memberRows = await this.db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(asc(groupMembers.joinedAt));
    const memberIds = memberRows.map((m) => m.userId);
    const people = await this.directory.people(memberIds);
    const statuses =
      movieIds.length && memberIds.length
        ? await this.db
            .select({
              userId: userMovies.userId,
              movieId: userMovies.movieId,
              status: userMovies.status,
            })
            .from(userMovies)
            .where(
              and(inArray(userMovies.userId, memberIds), inArray(userMovies.movieId, movieIds)),
            )
        : [];
    const byKey = new Map(statuses.map((s) => [`${s.userId}:${s.movieId}`, s.status]));
    return new Map(
      movieIds.map((movieId) => [
        movieId,
        memberIds.map((memberId) => ({
          userId: memberId,
          displayName: people.get(memberId)?.displayName ?? 'Movie fan',
          status: byKey.get(`${memberId}:${movieId}`) ?? null,
        })),
      ]),
    );
  }

  private select(userId: string) {
    return this.db
      .select({
        entry: groupMovies,
        movie: movies,
        ratingAverage: sql<
          number | null
        >`(select round(avg(r.rating), 1) from ${groupMovieRatings} r where r.group_id = ${groupMovies.groupId} and r.movie_id = ${groupMovies.movieId})`.mapWith(
          Number,
        ),
        ratingCount:
          sql<number>`(select count(*) from ${groupMovieRatings} r where r.group_id = ${groupMovies.groupId} and r.movie_id = ${groupMovies.movieId})`.mapWith(
            Number,
          ),
        myRating: sql<
          number | null
        >`(select r.rating from ${groupMovieRatings} r where r.group_id = ${groupMovies.groupId} and r.movie_id = ${groupMovies.movieId} and r.user_id = ${userId})`.mapWith(
          Number,
        ),
        total: sql<number>`count(*) over()`.mapWith(Number),
      })
      .from(groupMovies)
      .innerJoin(movies, eq(movies.id, groupMovies.movieId))
      .$dynamic();
  }

  private conditions(groupId: string, filters: GroupMovieFiltersDto): SQL[] {
    const conditions: SQL[] = [eq(groupMovies.groupId, groupId)];
    if (filters.status) conditions.push(eq(groupMovies.status, filters.status));
    if (filters.genreIds?.length) conditions.push(arrayOverlaps(movies.genreIds, filters.genreIds));
    if (filters.maxRuntime) conditions.push(lte(movies.runtime, filters.maxRuntime));
    if (filters.query) conditions.push(ilike(movies.title, likePattern(filters.query)));
    return conditions;
  }

  private order(sort: GroupMovieSort): SQL[] {
    switch (sort) {
      case 'added_asc':
        return [asc(groupMovies.addedAt)];
      case 'title_asc':
        return [asc(movies.title)];
      case 'release_desc':
        return [descNullsLast(movies.releaseDate)];
      case 'group_rating_desc':
        return [
          sql`(select avg(r.rating) from ${groupMovieRatings} r where r.group_id = ${groupMovies.groupId} and r.movie_id = ${groupMovies.movieId}) desc nulls last`,
        ];
      case 'tmdb_rating_desc':
        return [descNullsLast(movies.voteAverage)];
      case 'added_desc':
        return [desc(groupMovies.addedAt)];
    }
  }

  private async toViews(groupId: string, rows: Row[]): Promise<GroupMovieView[]> {
    const statuses = await this.memberStatuses(
      groupId,
      rows.map((row) => row.entry.movieId),
    );
    const people = await this.directory.people(
      rows.flatMap((row) => (row.entry.addedBy ? [row.entry.addedBy] : [])),
    );
    return rows.map((row) => ({
      movie: { ...this.presenter.fromRow(row.movie), runtime: row.movie.runtime },
      status: row.entry.status,
      watchedOn: row.entry.watchedOn,
      note: row.entry.note,
      addedBy: row.entry.addedBy ? (people.get(row.entry.addedBy) ?? null) : null,
      addedAt: row.entry.addedAt,
      groupRating: { average: row.ratingAverage, count: row.ratingCount, mine: row.myRating },
      members: statuses.get(row.entry.movieId) ?? [],
    }));
  }
}
