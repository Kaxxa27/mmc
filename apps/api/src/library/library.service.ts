import { Injectable } from '@nestjs/common';
import {
  and,
  arrayOverlaps,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { offsetOf, type Paginated, paginated } from '../common/dto/pagination.dto.js';
import { badRequest, notFound } from '../common/errors.js';
import { todayIsoDate } from '../common/utils/dates.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database, DbExecutor } from '../database/database.types.js';
import {
  movies,
  reviews,
  userMovies,
  watchEvents,
  type MovieStatus,
} from '../database/schema/index.js';
import { GenresService } from '../movies/genres.service.js';
import { MovieStore } from '../movies/movie-store.service.js';
import { MoviePresenter } from '../movies/movie.presenter.js';
import type { MovieRow } from '../movies/movie.types.js';
import { ascNullsLast, descNullsLast, likePattern } from '../movies/sql-helpers.js';
import type {
  CreateWatchEventDto,
  LibraryFiltersDto,
  LibrarySort,
  ListLibraryQueryDto,
  UpdateWatchEventDto,
  UpsertLibraryEntryDto,
} from './dto/library.dto.js';
import type {
  DefaultList,
  LibraryEntry,
  LibraryMovie,
  LibraryStats,
  WatchEventView,
} from './library.types.js';

type UserMovieRow = typeof userMovies.$inferSelect;
type WatchEventRow = typeof watchEvents.$inferSelect;

const SORTS: Record<LibrarySort, SQL[]> = {
  added_desc: [desc(userMovies.addedAt)],
  added_asc: [asc(userMovies.addedAt)],
  title_asc: [asc(movies.title)],
  title_desc: [desc(movies.title)],
  release_desc: [descNullsLast(movies.releaseDate)],
  release_asc: [ascNullsLast(movies.releaseDate)],
  rating_desc: [descNullsLast(userMovies.rating), desc(userMovies.addedAt)],
  rating_asc: [ascNullsLast(userMovies.rating), desc(userMovies.addedAt)],
  tmdb_rating_desc: [descNullsLast(movies.voteAverage)],
  popularity_desc: [descNullsLast(movies.popularity)],
  watched_desc: [descNullsLast(userMovies.lastWatchedOn), desc(userMovies.addedAt)],
  runtime_asc: [ascNullsLast(movies.runtime)],
  runtime_desc: [descNullsLast(movies.runtime)],
};

/** The personal catalog: statuses, favorites, ratings, private notes and viewing history. */
@Injectable()
export class LibraryService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly store: MovieStore,
    private readonly presenter: MoviePresenter,
    private readonly genres: GenresService,
  ) {}

  async list(userId: string, query: ListLibraryQueryDto): Promise<Paginated<LibraryEntry>> {
    const rows = await this.db
      .select({
        entry: userMovies,
        movie: movies,
        watchCount: this.watchCountSql(),
        total: sql<number>`count(*) over()`.mapWith(Number),
      })
      .from(userMovies)
      .innerJoin(movies, eq(movies.id, userMovies.movieId))
      .where(and(...this.conditions(userId, query)))
      .orderBy(...SORTS[query.sort ?? 'added_desc'], asc(movies.tmdbId))
      .limit(query.pageSize)
      .offset(offsetOf(query.page, query.pageSize));
    return paginated(
      rows.map((row) => this.toEntry(row)),
      rows[0]?.total ?? 0,
      query.page,
      query.pageSize,
    );
  }

  /** Random pick from the catalog (defaults to the watchlist). */
  async random(userId: string, filters: LibraryFiltersDto): Promise<LibraryEntry> {
    const [row] = await this.db
      .select({ entry: userMovies, movie: movies, watchCount: this.watchCountSql() })
      .from(userMovies)
      .innerJoin(movies, eq(movies.id, userMovies.movieId))
      // DTO fields always exist (possibly undefined), so apply the default explicitly.
      .where(
        and(
          ...this.conditions(userId, { ...filters, status: filters.status ?? ['want_to_watch'] }),
        ),
      )
      .orderBy(sql`random()`)
      .limit(1);
    if (!row)
      throw notFound('NO_MATCHING_MOVIES', 'No movie in your catalog matches these filters.');
    return this.toEntry(row);
  }

  async get(userId: string, tmdbId: number): Promise<LibraryEntry> {
    const [row] = await this.db
      .select({ entry: userMovies, movie: movies, watchCount: this.watchCountSql() })
      .from(userMovies)
      .innerJoin(movies, eq(movies.id, userMovies.movieId))
      .where(and(eq(userMovies.userId, userId), eq(movies.tmdbId, tmdbId)));
    if (!row) throw notFound('NOT_IN_LIBRARY', 'This movie is not in your catalog.');
    return this.toEntry(row);
  }

  /** Adds the movie to the catalog or updates it. Returns whether it was newly added. */
  async upsert(
    userId: string,
    tmdbId: number,
    dto: UpsertLibraryEntryDto,
  ): Promise<{ entry: LibraryEntry; created: boolean }> {
    const today = todayIsoDate();
    if (dto.watchedOn && dto.watchedOn > today) {
      throw badRequest('INVALID_WATCH_DATE', 'The viewing date cannot be in the future.');
    }
    const movie = await this.store.ensure(tmdbId);

    const created = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(userMovies)
        .where(and(eq(userMovies.userId, userId), eq(userMovies.movieId, movie.id)))
        .for('update');

      let status: MovieStatus | null = existing ? existing.status : null;
      if (dto.status !== undefined) status = dto.status;
      else if (dto.watchedOn) status = 'watched';
      else if (!existing) status = dto.rating ? 'watched' : dto.isFavorite ? null : 'want_to_watch';

      const statusChanged = !existing || existing.status !== status;
      const values = {
        status,
        isFavorite: dto.isFavorite ?? existing?.isFavorite ?? false,
        rating: dto.rating !== undefined ? dto.rating : (existing?.rating ?? null),
        notes: dto.notes !== undefined ? dto.notes : (existing?.notes ?? null),
        statusChangedAt: statusChanged && status ? new Date() : (existing?.statusChangedAt ?? null),
      };
      if (existing) {
        await tx
          .update(userMovies)
          .set(values)
          .where(and(eq(userMovies.userId, userId), eq(userMovies.movieId, movie.id)));
      } else {
        await tx.insert(userMovies).values({ userId, movieId: movie.id, ...values });
      }

      const becameWatched = status === 'watched' && existing?.status !== 'watched';
      const logViewing =
        Boolean(dto.watchedOn) ||
        (becameWatched && dto.status === 'watched' && dto.logViewing !== false);
      if (logViewing) {
        await this.insertViewing(tx, userId, movie.id, {
          watchedOn: dto.watchedOn ?? today,
          rating: values.rating,
          notes: null,
        });
      }
      return !existing;
    });
    return { entry: await this.get(userId, tmdbId), created };
  }

  async remove(userId: string, tmdbId: number, includeHistory = false): Promise<void> {
    const movie = await this.store.findByTmdbId(tmdbId);
    const deleted = movie
      ? await this.db
          .delete(userMovies)
          .where(and(eq(userMovies.userId, userId), eq(userMovies.movieId, movie.id)))
          .returning({ movieId: userMovies.movieId })
      : [];
    if (!movie || deleted.length === 0) {
      throw notFound('NOT_IN_LIBRARY', 'This movie is not in your catalog.');
    }
    if (includeHistory) {
      await this.db
        .delete(watchEvents)
        .where(and(eq(watchEvents.userId, userId), eq(watchEvents.movieId, movie.id)));
    }
  }

  /** The built-in lists: watchlist, watching, watched, favorites, highest rated, recently added. */
  async defaultLists(userId: string): Promise<DefaultList[]> {
    const definitions: Omit<DefaultList, 'count' | 'preview'>[] = [
      { key: 'watchlist', name: 'Watchlist', query: { status: 'want_to_watch' } },
      { key: 'watching', name: 'Currently Watching', query: { status: 'watching' } },
      {
        key: 'watched',
        name: 'Watched Movies',
        query: { status: 'watched', sort: 'watched_desc' },
      },
      { key: 'favorites', name: 'Favorites', query: { favorite: 'true' } },
      {
        key: 'highest_rated',
        name: 'Highest Rated',
        query: { minRating: '8', sort: 'rating_desc' },
      },
      { key: 'recently_added', name: 'Recently Added', query: { sort: 'added_desc' } },
    ];
    return Promise.all(
      definitions.map(async (definition) => {
        const filters: ListLibraryQueryDto = {
          page: 1,
          pageSize: 4,
          ...(definition.query.status ? { status: [definition.query.status as MovieStatus] } : {}),
          ...(definition.query.favorite ? { favorite: true } : {}),
          ...(definition.query.minRating ? { minRating: Number(definition.query.minRating) } : {}),
          sort: (definition.query.sort as LibrarySort | undefined) ?? 'added_desc',
        };
        const result = await this.list(userId, filters);
        return {
          ...definition,
          count: result.total,
          preview: result.items.map((item) => item.movie),
        };
      }),
    );
  }

  async history(
    userId: string,
    query: { page: number; pageSize: number; from?: string; to?: string },
  ): Promise<Paginated<WatchEventView>> {
    const conditions: SQL[] = [eq(watchEvents.userId, userId)];
    if (query.from) conditions.push(gte(watchEvents.watchedOn, query.from));
    if (query.to) conditions.push(lte(watchEvents.watchedOn, query.to));
    const rows = await this.db
      .select({
        event: watchEvents,
        movie: movies,
        total: sql<number>`count(*) over()`.mapWith(Number),
      })
      .from(watchEvents)
      .innerJoin(movies, eq(movies.id, watchEvents.movieId))
      .where(and(...conditions))
      .orderBy(desc(watchEvents.watchedOn), desc(watchEvents.createdAt))
      .limit(query.pageSize)
      .offset(offsetOf(query.page, query.pageSize));
    return paginated(
      rows.map((row) => this.toWatchEvent(row.event, row.movie)),
      rows[0]?.total ?? 0,
      query.page,
      query.pageSize,
    );
  }

  /** Logs a viewing; the movie is added to the catalog as watched if needed. */
  async logViewing(
    userId: string,
    dto: CreateWatchEventDto,
    options: { movieNightId?: string } = {},
  ): Promise<WatchEventView> {
    const watchedOn = dto.watchedOn ?? todayIsoDate();
    this.assertNotFuture(watchedOn);
    const movie = await this.store.ensure(dto.tmdbId);
    const eventId = await this.db.transaction(async (tx) => {
      await tx
        .insert(userMovies)
        .values({
          userId,
          movieId: movie.id,
          status: 'watched',
          rating: dto.rating ?? null,
          statusChangedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userMovies.userId, userMovies.movieId],
          set: {
            status: 'watched',
            rating: dto.rating === undefined ? sql`${userMovies.rating}` : dto.rating,
            statusChangedAt: sql`case when ${userMovies.status} is distinct from 'watched' then now() else ${userMovies.statusChangedAt} end`,
          },
        });
      return this.insertViewing(tx, userId, movie.id, {
        watchedOn,
        rating: dto.rating ?? null,
        notes: dto.notes ?? null,
        isRewatch: dto.isRewatch,
        movieNightId: options.movieNightId,
      });
    });
    return this.getWatchEvent(userId, eventId);
  }

  async updateViewing(
    userId: string,
    eventId: string,
    dto: UpdateWatchEventDto,
  ): Promise<WatchEventView> {
    if (dto.watchedOn) this.assertNotFuture(dto.watchedOn);
    await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(watchEvents)
        .set({
          ...(dto.watchedOn !== undefined ? { watchedOn: dto.watchedOn } : {}),
          ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.isRewatch !== undefined ? { isRewatch: dto.isRewatch } : {}),
        })
        .where(and(eq(watchEvents.id, eventId), eq(watchEvents.userId, userId)))
        .returning({ movieId: watchEvents.movieId });
      if (!updated) throw notFound('VIEWING_NOT_FOUND', 'Viewing not found.');
      await this.syncLastWatched(tx, userId, updated.movieId);
    });
    return this.getWatchEvent(userId, eventId);
  }

  async deleteViewing(userId: string, eventId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(watchEvents)
        .where(and(eq(watchEvents.id, eventId), eq(watchEvents.userId, userId)))
        .returning({ movieId: watchEvents.movieId });
      if (!deleted) throw notFound('VIEWING_NOT_FOUND', 'Viewing not found.');
      await this.syncLastWatched(tx, userId, deleted.movieId);
    });
  }

  async stats(userId: string): Promise<LibraryStats> {
    const [totals] = await this.db
      .select({
        inCatalog:
          sql<number>`count(*) filter (where ${userMovies.status} is distinct from 'not_interested')`.mapWith(
            Number,
          ),
        watched: sql<number>`count(*) filter (where ${userMovies.status} = 'watched')`.mapWith(
          Number,
        ),
        wantToWatch:
          sql<number>`count(*) filter (where ${userMovies.status} = 'want_to_watch')`.mapWith(
            Number,
          ),
        watching: sql<number>`count(*) filter (where ${userMovies.status} = 'watching')`.mapWith(
          Number,
        ),
        notInterested:
          sql<number>`count(*) filter (where ${userMovies.status} = 'not_interested')`.mapWith(
            Number,
          ),
        favorites: sql<number>`count(*) filter (where ${userMovies.isFavorite})`.mapWith(Number),
        rated: sql<number>`count(${userMovies.rating})`.mapWith(Number),
        averageRating: sql<string | null>`round(avg(${userMovies.rating}), 1)`,
      })
      .from(userMovies)
      .where(eq(userMovies.userId, userId));
    const [reviewCount] = await this.db
      .select({ value: count() })
      .from(reviews)
      .where(eq(reviews.userId, userId));
    const [viewings] = await this.db
      .select({
        count: count(),
        minutes: sql<number>`coalesce(sum(${movies.runtime}), 0)`.mapWith(Number),
      })
      .from(watchEvents)
      .innerJoin(movies, eq(movies.id, watchEvents.movieId))
      .where(eq(watchEvents.userId, userId));

    const topGenres = await this.db.execute<{ genre_id: number; count: string }>(sql`
      select genre_id, count(*) as count
      from ${userMovies} um
      join ${movies} m on m.id = um.movie_id
      cross join lateral unnest(m.genre_ids) as genre_id
      where um.user_id = ${userId} and um.status = 'watched'
      group by genre_id
      order by count(*) desc, genre_id
      limit 5
    `);
    const byMonth = await this.db.execute<{ month: string; count: string }>(sql`
      select to_char(date_trunc('month', watched_on), 'YYYY-MM') as month, count(*) as count
      from ${watchEvents}
      where user_id = ${userId}
        and watched_on >= date_trunc('month', current_date) - interval '11 months'
      group by 1
      order by 1
    `);
    const busiest = await this.db.execute<{ month: string; count: string }>(sql`
      select to_char(date_trunc('month', watched_on), 'YYYY-MM') as month, count(*) as count
      from ${watchEvents}
      where user_id = ${userId}
      group by 1
      order by count(*) desc, 1 desc
      limit 3
    `);

    const genreNames = new Map(
      this.genres
        .refs(topGenres.rows.map((row) => Number(row.genre_id)))
        .map((g) => [g.id, g.name]),
    );
    return {
      totals: {
        inCatalog: totals?.inCatalog ?? 0,
        watched: totals?.watched ?? 0,
        wantToWatch: totals?.wantToWatch ?? 0,
        watching: totals?.watching ?? 0,
        notInterested: totals?.notInterested ?? 0,
        favorites: totals?.favorites ?? 0,
        rated: totals?.rated ?? 0,
        reviews: reviewCount?.value ?? 0,
        viewings: viewings?.count ?? 0,
      },
      averageRating: totals?.averageRating ? Number(totals.averageRating) : null,
      totalWatchTimeMinutes: viewings?.minutes ?? 0,
      topGenres: topGenres.rows.map((row) => ({
        id: Number(row.genre_id),
        name: genreNames.get(Number(row.genre_id)) ?? 'Unknown',
        count: Number(row.count),
      })),
      viewingsByMonth: byMonth.rows.map((row) => ({ month: row.month, count: Number(row.count) })),
      mostActiveMonths: busiest.rows.map((row) => ({ month: row.month, count: Number(row.count) })),
    };
  }

  private async insertViewing(
    tx: DbExecutor,
    userId: string,
    movieId: string,
    viewing: {
      watchedOn: string;
      rating: number | null;
      notes: string | null;
      isRewatch?: boolean;
      movieNightId?: string;
    },
  ): Promise<string> {
    const [previous] = await tx
      .select({ value: count() })
      .from(watchEvents)
      .where(and(eq(watchEvents.userId, userId), eq(watchEvents.movieId, movieId)));
    const [event] = await tx
      .insert(watchEvents)
      .values({
        userId,
        movieId,
        watchedOn: viewing.watchedOn,
        rating: viewing.rating,
        notes: viewing.notes,
        isRewatch: viewing.isRewatch ?? (previous?.value ?? 0) > 0,
        movieNightId: viewing.movieNightId ?? null,
      })
      .returning({ id: watchEvents.id });
    await this.syncLastWatched(tx, userId, movieId);
    if (!event) throw new Error('Could not record viewing');
    return event.id;
  }

  private async syncLastWatched(tx: DbExecutor, userId: string, movieId: string): Promise<void> {
    await tx
      .update(userMovies)
      .set({
        lastWatchedOn: sql`(select max(${watchEvents.watchedOn}) from ${watchEvents} where ${watchEvents.userId} = ${userId} and ${watchEvents.movieId} = ${movieId})`,
      })
      .where(and(eq(userMovies.userId, userId), eq(userMovies.movieId, movieId)));
  }

  private async getWatchEvent(userId: string, eventId: string): Promise<WatchEventView> {
    const [row] = await this.db
      .select({ event: watchEvents, movie: movies })
      .from(watchEvents)
      .innerJoin(movies, eq(movies.id, watchEvents.movieId))
      .where(and(eq(watchEvents.id, eventId), eq(watchEvents.userId, userId)));
    if (!row) throw notFound('VIEWING_NOT_FOUND', 'Viewing not found.');
    return this.toWatchEvent(row.event, row.movie);
  }

  private conditions(userId: string, filters: LibraryFiltersDto): SQL[] {
    const conditions: SQL[] = [eq(userMovies.userId, userId)];
    if (filters.status?.length) conditions.push(inArray(userMovies.status, filters.status));
    else conditions.push(sql`${userMovies.status} is distinct from 'not_interested'`);
    if (filters.favorite !== undefined)
      conditions.push(eq(userMovies.isFavorite, filters.favorite));
    if (filters.genreIds?.length) conditions.push(arrayOverlaps(movies.genreIds, filters.genreIds));
    if (filters.yearFrom) conditions.push(gte(movies.releaseDate, `${filters.yearFrom}-01-01`));
    if (filters.yearTo) conditions.push(lte(movies.releaseDate, `${filters.yearTo}-12-31`));
    if (filters.minRating) conditions.push(gte(userMovies.rating, filters.minRating));
    if (filters.maxRating) conditions.push(lte(userMovies.rating, filters.maxRating));
    if (filters.maxRuntime) conditions.push(lte(movies.runtime, filters.maxRuntime));
    if (filters.query) {
      const pattern = likePattern(filters.query);
      conditions.push(
        or(ilike(movies.title, pattern), ilike(movies.originalTitle, pattern)) as SQL,
      );
    }
    return conditions;
  }

  private watchCountSql() {
    return sql<number>`(select count(*) from ${watchEvents} where ${watchEvents.userId} = ${userMovies.userId} and ${watchEvents.movieId} = ${userMovies.movieId})`.mapWith(
      Number,
    );
  }

  private assertNotFuture(date: string): void {
    if (date > todayIsoDate()) {
      throw badRequest('INVALID_WATCH_DATE', 'The viewing date cannot be in the future.');
    }
  }

  private movie(row: MovieRow): LibraryMovie {
    return { ...this.presenter.fromRow(row), runtime: row.runtime };
  }

  private toEntry(row: { entry: UserMovieRow; movie: MovieRow; watchCount: number }): LibraryEntry {
    return {
      movie: this.movie(row.movie),
      status: row.entry.status,
      isFavorite: row.entry.isFavorite,
      rating: row.entry.rating,
      notes: row.entry.notes,
      lastWatchedOn: row.entry.lastWatchedOn,
      watchCount: row.watchCount,
      addedAt: row.entry.addedAt,
      updatedAt: row.entry.updatedAt,
    };
  }

  private toWatchEvent(event: WatchEventRow, movie: MovieRow): WatchEventView {
    return {
      id: event.id,
      movie: this.movie(movie),
      watchedOn: event.watchedOn,
      rating: event.rating,
      notes: event.notes,
      isRewatch: event.isRewatch,
      movieNightId: event.movieNightId,
      createdAt: event.createdAt,
    };
  }
}
