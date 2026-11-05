import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { offsetOf, type Paginated, paginated } from '../common/dto/pagination.dto.js';
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { todayIsoDate } from '../common/utils/dates.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  groupMovieRatings,
  groupMovies,
  groups,
  movieNightCandidates,
  movieNightParticipants,
  movieNights,
  movieNightVotes,
  movies,
  type MovieNightCriteria,
  type MovieNightStatus,
} from '../database/schema/index.js';
import { GroupAccessService, hasRole, type Membership } from '../groups/group-access.service.js';
import { type PersonView, UserDirectoryService } from '../groups/user-directory.service.js';
import { LibraryService } from '../library/library.service.js';
import type { WatchEventView } from '../library/library.types.js';
import { MovieStore } from '../movies/movie-store.service.js';
import { MoviePresenter } from '../movies/movie.presenter.js';
import type { MovieRow, MovieSummary } from '../movies/movie.types.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type {
  CreateMovieNightDto,
  ListMovieNightsQueryDto,
  LogMovieNightViewingDto,
  UpdateMovieNightDto,
} from './dto/movie-nights.dto.js';
import {
  decideWinner,
  pickRandom,
  rankSuggestions,
  type SuggestionInput,
  tallyVotes,
} from './movie-night.logic.js';

type MovieNightRow = typeof movieNights.$inferSelect;
type MovieCard = MovieSummary & { runtime: number | null };

export interface MovieNightSummary {
  id: string;
  group: { id: string; name: string };
  title: string;
  description: string | null;
  scheduledAt: Date | null;
  status: MovieNightStatus;
  decisionMethod: string | null;
  selectedMovie: MovieCard | null;
  participantCount: number;
  candidateCount: number;
  createdBy: PersonView | null;
  createdAt: Date;
}

export interface CandidateView {
  movie: MovieCard;
  votes: number;
  /** Who voted for it; revealed once the movie is decided. */
  voters: PersonView[] | null;
  addedBy: PersonView | null;
}

export interface MovieNightDetails extends MovieNightSummary {
  criteria: MovieNightCriteria;
  participants: PersonView[];
  candidates: CandidateView[];
  votesCast: number;
  myVoteTmdbId: number | null;
  votingStartedAt: Date | null;
  decidedAt: Date | null;
  decidedBy: PersonView | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  /** Group ratings of the selected movie by the participants. */
  finalRatings: { average: number | null; ratings: { user: PersonView; rating: number }[] } | null;
  permissions: {
    canManage: boolean;
    canVote: boolean;
    canAddCandidates: boolean;
    isParticipant: boolean;
  };
}

export interface SuggestionView {
  movie: MovieCard;
  score: number;
  reasons: string[];
  wantedBy: number;
  watchedBy: number;
  inGroupWatchlist: boolean;
}

interface Context {
  night: MovieNightRow;
  membership: Membership;
  isParticipant: boolean;
  canManage: boolean;
}

const OPEN: MovieNightStatus[] = ['planning', 'voting'];

/** Movie Night Planner: shortlist, candidates, voting, random picks and history. */
@Injectable()
export class MovieNightsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly access: GroupAccessService,
    private readonly directory: UserDirectoryService,
    private readonly store: MovieStore,
    private readonly presenter: MoviePresenter,
    private readonly library: LibraryService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    groupId: string,
    userId: string,
    query: ListMovieNightsQueryDto,
  ): Promise<Paginated<MovieNightSummary>> {
    await this.access.require(groupId, userId, { allowArchived: true });
    const conditions: SQL[] = [eq(movieNights.groupId, groupId)];
    if (query.status) conditions.push(eq(movieNights.status, query.status));
    if (query.when === 'upcoming') {
      conditions.push(
        sql`(${movieNights.status} in ('planning', 'voting', 'decided') and (${movieNights.scheduledAt} is null or ${movieNights.scheduledAt} >= now() - interval '6 hours'))`,
      );
    } else if (query.when === 'past') {
      conditions.push(
        sql`(${movieNights.status} in ('completed', 'cancelled') or ${movieNights.scheduledAt} < now() - interval '6 hours')`,
      );
    }
    const order =
      query.when === 'upcoming'
        ? [sql`${movieNights.scheduledAt} asc nulls last`, asc(movieNights.createdAt)]
        : [sql`${movieNights.scheduledAt} desc nulls last`, desc(movieNights.createdAt)];
    const rows = await this.db
      .select({ night: movieNights, total: sql<number>`count(*) over()`.mapWith(Number) })
      .from(movieNights)
      .where(and(...conditions))
      .orderBy(...order)
      .limit(query.pageSize)
      .offset(offsetOf(query.page, query.pageSize));
    return paginated(
      await this.summaries(rows.map((row) => row.night)),
      rows[0]?.total ?? 0,
      query.page,
      query.pageSize,
    );
  }

  async create(
    groupId: string,
    userId: string,
    dto: CreateMovieNightDto,
  ): Promise<MovieNightDetails> {
    const membership = await this.access.require(groupId, userId);
    const participantIds = await this.validParticipants(groupId, userId, dto.participantIds);
    const nightId = await this.db.transaction(async (tx) => {
      const [night] = await tx
        .insert(movieNights)
        .values({
          groupId,
          createdBy: userId,
          title: dto.title,
          description: dto.description ?? null,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
          criteria: this.cleanCriteria(dto.criteria),
        })
        .returning({ id: movieNights.id });
      await tx
        .insert(movieNightParticipants)
        .values(participantIds.map((id) => ({ movieNightId: night!.id, userId: id })));
      return night!.id;
    });

    const organiser = await this.directory.displayNameOf(userId);
    const when = dto.scheduledAt ? new Date(dto.scheduledAt).toUTCString() : 'a date to be agreed';
    await this.notifications.notify({
      recipientIds: participantIds,
      actorId: userId,
      type: 'movie_night_scheduled',
      title: `${organiser} planned a movie night: ${dto.title}`,
      body: `${membership.groupName}, ${when}.`,
      data: { groupId, movieNightId: nightId },
      email: {
        subject: `Movie night in ${membership.groupName}: ${dto.title}`,
        content: {
          heading: dto.title,
          paragraphs: [
            `${organiser} planned a movie night in ${membership.groupName} for ${when}.`,
            'Suggest movies and vote for your favorite in My Movie Catalog.',
          ],
        },
      },
    });
    return this.get(nightId, userId);
  }

  async get(nightId: string, userId: string): Promise<MovieNightDetails> {
    const ctx = await this.context(nightId, userId);
    const { night } = ctx;
    const [summary] = await this.summaries([night]);

    const participantRows = await this.db
      .select({ userId: movieNightParticipants.userId })
      .from(movieNightParticipants)
      .where(eq(movieNightParticipants.movieNightId, nightId))
      .orderBy(asc(movieNightParticipants.joinedAt));
    const candidateRows = await this.db
      .select({ candidate: movieNightCandidates, movie: movies })
      .from(movieNightCandidates)
      .innerJoin(movies, eq(movies.id, movieNightCandidates.movieId))
      .where(eq(movieNightCandidates.movieNightId, nightId))
      .orderBy(asc(movieNightCandidates.addedAt));
    const votes = await this.db
      .select({ userId: movieNightVotes.userId, movieId: movieNightVotes.movieId })
      .from(movieNightVotes)
      .where(eq(movieNightVotes.movieNightId, nightId));

    const ratings =
      night.selectedMovieId && (night.status === 'decided' || night.status === 'completed')
        ? await this.db
            .select({ userId: groupMovieRatings.userId, rating: groupMovieRatings.rating })
            .from(groupMovieRatings)
            .innerJoin(
              movieNightParticipants,
              and(
                eq(movieNightParticipants.userId, groupMovieRatings.userId),
                eq(movieNightParticipants.movieNightId, nightId),
              ),
            )
            .where(
              and(
                eq(groupMovieRatings.groupId, night.groupId),
                eq(groupMovieRatings.movieId, night.selectedMovieId),
              ),
            )
        : [];

    const people = await this.directory.people([
      ...participantRows.map((p) => p.userId),
      ...candidateRows.flatMap((c) => (c.candidate.addedBy ? [c.candidate.addedBy] : [])),
      ...ratings.map((r) => r.userId),
      ...(night.decidedBy ? [night.decidedBy] : []),
    ]);
    const person = (id: string): PersonView =>
      people.get(id) ?? { id, displayName: 'Movie fan', username: null, avatarUrl: null };

    const revealVoters = night.status === 'decided' || night.status === 'completed';
    const tally = new Map(
      tallyVotes(
        candidateRows.map((c) => c.candidate.movieId),
        votes,
      ).map((t) => [t.movieId, t.votes]),
    );
    const myVote = votes.find((vote) => vote.userId === userId);
    const myVoteTmdbId = myVote
      ? (candidateRows.find((c) => c.candidate.movieId === myVote.movieId)?.movie.tmdbId ?? null)
      : null;

    return {
      ...summary!,
      criteria: night.criteria,
      participants: participantRows.map((p) => person(p.userId)),
      candidates: candidateRows
        .map((c) => ({
          movie: this.card(c.movie),
          votes: tally.get(c.candidate.movieId) ?? 0,
          voters: revealVoters
            ? votes.filter((v) => v.movieId === c.candidate.movieId).map((v) => person(v.userId))
            : null,
          addedBy: c.candidate.addedBy ? person(c.candidate.addedBy) : null,
        }))
        .sort((a, b) => b.votes - a.votes),
      votesCast: votes.length,
      myVoteTmdbId,
      votingStartedAt: night.votingStartedAt,
      decidedAt: night.decidedAt,
      decidedBy: night.decidedBy ? person(night.decidedBy) : null,
      completedAt: night.completedAt,
      cancelledAt: night.cancelledAt,
      finalRatings:
        ratings.length > 0
          ? {
              average:
                Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 10) /
                10,
              ratings: ratings.map((r) => ({ user: person(r.userId), rating: r.rating })),
            }
          : null,
      permissions: {
        canManage: ctx.canManage,
        canVote: ctx.isParticipant && night.status === 'voting' && !ctx.membership.archived,
        canAddCandidates:
          (ctx.isParticipant || ctx.canManage) &&
          OPEN.includes(night.status) &&
          !ctx.membership.archived,
        isParticipant: ctx.isParticipant,
      },
    };
  }

  async update(
    nightId: string,
    userId: string,
    dto: UpdateMovieNightDto,
  ): Promise<MovieNightDetails> {
    const ctx = await this.context(nightId, userId, { manage: true, statuses: OPEN });
    const participantIds = dto.participantIds
      ? await this.validParticipants(
          ctx.night.groupId,
          ctx.night.createdBy ?? userId,
          dto.participantIds,
        )
      : undefined;
    await this.db.transaction(async (tx) => {
      await tx
        .update(movieNights)
        .set({
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.scheduledAt !== undefined
            ? { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null }
            : {}),
          ...(dto.criteria !== undefined ? { criteria: this.cleanCriteria(dto.criteria) } : {}),
        })
        .where(eq(movieNights.id, nightId));
      if (participantIds) {
        // Removing a participant also removes their vote (cascade).
        await tx
          .delete(movieNightParticipants)
          .where(eq(movieNightParticipants.movieNightId, nightId));
        await tx
          .insert(movieNightParticipants)
          .values(participantIds.map((id) => ({ movieNightId: nightId, userId: id })));
      }
    });
    return this.get(nightId, userId);
  }

  async remove(nightId: string, userId: string): Promise<void> {
    await this.context(nightId, userId, { manage: true });
    await this.db.delete(movieNights).where(eq(movieNights.id, nightId));
  }

  /** Shortlist of movies matching the criteria, best first. */
  async suggestions(nightId: string, userId: string, limit: number): Promise<SuggestionView[]> {
    const ctx = await this.context(nightId, userId);
    return this.computeSuggestions(ctx.night, limit);
  }

  async addCandidates(
    nightId: string,
    userId: string,
    tmdbIds: number[],
  ): Promise<MovieNightDetails> {
    const ctx = await this.context(nightId, userId, { statuses: OPEN });
    if (!ctx.isParticipant && !ctx.canManage) {
      throw forbidden('NOT_PARTICIPANT', 'Only participants can suggest movies.');
    }
    const rows: MovieRow[] = [];
    for (const tmdbId of tmdbIds) rows.push(await this.store.ensure(tmdbId));
    await this.db
      .insert(movieNightCandidates)
      .values(rows.map((row) => ({ movieNightId: nightId, movieId: row.id, addedBy: userId })))
      .onConflictDoNothing();
    return this.get(nightId, userId);
  }

  async addSuggestedCandidates(
    nightId: string,
    userId: string,
    limit = 5,
  ): Promise<MovieNightDetails> {
    const ctx = await this.context(nightId, userId, { manage: true, statuses: OPEN });
    const suggestions = await this.computeSuggestions(ctx.night, limit);
    if (suggestions.length === 0) {
      throw notFound('NO_MATCHING_MOVIES', 'No movie on the watchlists matches the criteria.');
    }
    return this.addCandidates(
      nightId,
      userId,
      suggestions.map((s) => s.movie.tmdbId),
    );
  }

  async removeCandidate(
    nightId: string,
    userId: string,
    tmdbId: number,
  ): Promise<MovieNightDetails> {
    const ctx = await this.context(nightId, userId, { statuses: OPEN });
    const movie = await this.store.findByTmdbId(tmdbId);
    const [candidate] = movie
      ? await this.db
          .select()
          .from(movieNightCandidates)
          .where(
            and(
              eq(movieNightCandidates.movieNightId, nightId),
              eq(movieNightCandidates.movieId, movie.id),
            ),
          )
      : [];
    if (!candidate) throw notFound('CANDIDATE_NOT_FOUND', 'This movie is not a candidate.');
    if (!ctx.canManage && candidate.addedBy !== userId) {
      throw forbidden(
        'GROUP_PERMISSION_DENIED',
        'Only the organiser or the person who suggested it can remove it.',
      );
    }
    await this.db
      .delete(movieNightCandidates)
      .where(
        and(
          eq(movieNightCandidates.movieNightId, nightId),
          eq(movieNightCandidates.movieId, candidate.movieId),
        ),
      );
    return this.get(nightId, userId);
  }

  async startVoting(nightId: string, userId: string): Promise<MovieNightDetails> {
    const ctx = await this.context(nightId, userId, { manage: true, statuses: ['planning'] });
    const [{ value = 0 } = {}] = await this.db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(movieNightCandidates)
      .where(eq(movieNightCandidates.movieNightId, nightId));
    if (value < 2) {
      throw conflict(
        'NOT_ENOUGH_CANDIDATES',
        'Add at least two candidate movies before starting the vote.',
      );
    }
    await this.db
      .update(movieNights)
      .set({ status: 'voting', votingStartedAt: new Date() })
      .where(eq(movieNights.id, nightId));
    await this.notifications.notify({
      recipientIds: await this.participantIds(nightId),
      actorId: userId,
      type: 'movie_night_voting_started',
      title: `Voting is open: ${ctx.night.title}`,
      body: `Pick your favorite among ${value} movies.`,
      data: { groupId: ctx.night.groupId, movieNightId: nightId },
    });
    return this.get(nightId, userId);
  }

  /** One vote per participant; voting again replaces the previous vote. */
  async vote(nightId: string, userId: string, tmdbId: number): Promise<MovieNightDetails> {
    const ctx = await this.context(nightId, userId, { statuses: ['voting'] });
    if (!ctx.isParticipant) throw forbidden('NOT_PARTICIPANT', 'Only participants can vote.');
    const movie = await this.store.findByTmdbId(tmdbId);
    const [candidate] = movie
      ? await this.db
          .select({ movieId: movieNightCandidates.movieId })
          .from(movieNightCandidates)
          .where(
            and(
              eq(movieNightCandidates.movieNightId, nightId),
              eq(movieNightCandidates.movieId, movie.id),
            ),
          )
      : [];
    if (!candidate)
      throw badRequest('NOT_A_CANDIDATE', 'You can only vote for one of the candidates.');
    await this.db
      .insert(movieNightVotes)
      .values({ movieNightId: nightId, userId, movieId: candidate.movieId })
      .onConflictDoUpdate({
        target: [movieNightVotes.movieNightId, movieNightVotes.userId],
        set: { movieId: candidate.movieId },
      });
    return this.get(nightId, userId);
  }

  async withdrawVote(nightId: string, userId: string): Promise<MovieNightDetails> {
    await this.context(nightId, userId, { statuses: ['voting'] });
    await this.db
      .delete(movieNightVotes)
      .where(and(eq(movieNightVotes.movieNightId, nightId), eq(movieNightVotes.userId, userId)));
    return this.get(nightId, userId);
  }

  /** Ends the vote and selects the winner (ties: organiser's choice or random). */
  async closeVoting(
    nightId: string,
    userId: string,
    tieBreakerTmdbId?: number,
  ): Promise<MovieNightDetails> {
    await this.context(nightId, userId, { manage: true, statuses: ['voting'] });
    const candidates = await this.db
      .select({ movieId: movieNightCandidates.movieId, tmdbId: movies.tmdbId })
      .from(movieNightCandidates)
      .innerJoin(movies, eq(movies.id, movieNightCandidates.movieId))
      .where(eq(movieNightCandidates.movieNightId, nightId));
    const votes = await this.db
      .select({ movieId: movieNightVotes.movieId })
      .from(movieNightVotes)
      .where(eq(movieNightVotes.movieNightId, nightId));
    const tieBreaker = candidates.find((c) => c.tmdbId === tieBreakerTmdbId)?.movieId;
    const winner = decideWinner(
      tallyVotes(
        candidates.map((c) => c.movieId),
        votes,
      ),
      tieBreaker,
    );
    if (!winner) {
      throw conflict(
        'NO_VOTES',
        'Nobody has voted yet. Wait for votes, pick at random or choose a movie.',
      );
    }
    return this.decide(nightId, userId, winner.movieId, 'vote');
  }

  /** Lets chance decide: a random candidate, or a random match from the shortlist. */
  async pickRandom(nightId: string, userId: string): Promise<MovieNightDetails> {
    const ctx = await this.context(nightId, userId, { manage: true, statuses: OPEN });
    const candidates = await this.db
      .select({ movieId: movieNightCandidates.movieId })
      .from(movieNightCandidates)
      .where(eq(movieNightCandidates.movieNightId, nightId));
    let movieId = pickRandom(candidates)?.movieId;
    if (!movieId) {
      const suggestions = await this.computeSuggestions(ctx.night, 20);
      const choice = pickRandom(suggestions);
      if (choice) {
        const row = await this.store.ensure(choice.movie.tmdbId);
        await this.db
          .insert(movieNightCandidates)
          .values({ movieNightId: nightId, movieId: row.id, addedBy: userId })
          .onConflictDoNothing();
        movieId = row.id;
      }
    }
    if (!movieId) throw notFound('NO_MATCHING_MOVIES', 'No movie matches the criteria.');
    return this.decide(nightId, userId, movieId, 'random');
  }

  /** The organiser simply chooses the movie. */
  async select(nightId: string, userId: string, tmdbId: number): Promise<MovieNightDetails> {
    await this.context(nightId, userId, {
      manage: true,
      statuses: ['planning', 'voting', 'decided'],
    });
    const movie = await this.store.ensure(tmdbId);
    await this.db
      .insert(movieNightCandidates)
      .values({ movieNightId: nightId, movieId: movie.id, addedBy: userId })
      .onConflictDoNothing();
    return this.decide(nightId, userId, movie.id, 'manual');
  }

  /** The night happened: the movie is marked as watched together in the shared catalog. */
  async complete(nightId: string, userId: string): Promise<MovieNightDetails> {
    const ctx = await this.context(nightId, userId, { manage: true, statuses: ['decided'] });
    const watchedOn = this.nightDate(ctx.night);
    await this.db.transaction(async (tx) => {
      await tx
        .update(movieNights)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(movieNights.id, nightId));
      await tx
        .insert(groupMovies)
        .values({
          groupId: ctx.night.groupId,
          movieId: ctx.night.selectedMovieId!,
          status: 'watched',
          watchedOn,
          addedBy: userId,
        })
        .onConflictDoUpdate({
          target: [groupMovies.groupId, groupMovies.movieId],
          set: { status: 'watched', watchedOn },
        });
    });
    return this.get(nightId, userId);
  }

  /** Adds the movie-night viewing to the caller's personal history. */
  async logViewing(
    nightId: string,
    userId: string,
    dto: LogMovieNightViewingDto,
  ): Promise<WatchEventView> {
    const ctx = await this.context(nightId, userId, { statuses: ['decided', 'completed'] });
    if (!ctx.isParticipant)
      throw forbidden('NOT_PARTICIPANT', 'Only participants can log this movie night.');
    const [movie] = await this.db
      .select({ tmdbId: movies.tmdbId })
      .from(movies)
      .where(eq(movies.id, ctx.night.selectedMovieId!));
    return this.library.logViewing(
      userId,
      {
        tmdbId: movie!.tmdbId,
        watchedOn: dto.watchedOn ?? this.nightDate(ctx.night),
        rating: dto.rating,
      },
      { movieNightId: nightId },
    );
  }

  async cancel(nightId: string, userId: string): Promise<MovieNightDetails> {
    await this.context(nightId, userId, {
      manage: true,
      statuses: ['planning', 'voting', 'decided'],
    });
    await this.db
      .update(movieNights)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(movieNights.id, nightId));
    return this.get(nightId, userId);
  }

  private async decide(
    nightId: string,
    userId: string,
    movieId: string,
    method: 'vote' | 'random' | 'manual',
  ): Promise<MovieNightDetails> {
    const [night] = await this.db
      .update(movieNights)
      .set({
        status: 'decided',
        selectedMovieId: movieId,
        decisionMethod: method,
        decidedAt: new Date(),
        decidedBy: userId,
      })
      .where(eq(movieNights.id, nightId))
      .returning();
    const [movie] = await this.db.select().from(movies).where(eq(movies.id, movieId));
    const how = { vote: 'by vote', random: 'at random', manual: 'by the organiser' }[method];
    await this.notifications.notify({
      recipientIds: await this.participantIds(nightId),
      actorId: userId,
      type: 'movie_night_decided',
      title: `${night!.title}: we're watching ${movie!.title}`,
      body: `Chosen ${how}.`,
      data: { groupId: night!.groupId, movieNightId: nightId, tmdbId: movie!.tmdbId },
      email: {
        subject: `${night!.title}: we're watching ${movie!.title}`,
        content: {
          heading: `We're watching ${movie!.title}`,
          paragraphs: [
            `The movie for "${night!.title}" was chosen ${how}.`,
            night!.scheduledAt
              ? `See you on ${night!.scheduledAt.toUTCString()}.`
              : 'Enjoy the movie!',
          ],
        },
      },
    });
    return this.get(nightId, userId);
  }

  private async computeSuggestions(night: MovieNightRow, limit: number): Promise<SuggestionView[]> {
    const participantIds = await this.participantIds(night.id);
    const includeWatchlists = night.criteria.includeParticipantWatchlists === true;
    const pool = await this.db.execute<{
      movie_id: string;
      tmdb_id: number;
      title: string;
      genre_ids: number[];
      vote_average: number | null;
      runtime: number | null;
      certifications: Record<string, string>;
      in_group_watchlist: boolean;
      wanted_by: string;
      watched_by: string;
    }>(sql`
      with participants as (
        select user_id from ${movieNightParticipants} where movie_night_id = ${night.id}
      ),
      pool as (
        select gm.movie_id, true as in_group
        from ${groupMovies} gm
        where gm.group_id = ${night.groupId} and gm.status = 'want_to_watch'
        union all
        select um.movie_id, false as in_group
        from user_movies um
        where ${includeWatchlists}::boolean
          and um.user_id in (select user_id from participants)
          and um.status = 'want_to_watch'
      )
      select m.id as movie_id, m.tmdb_id, m.title, m.genre_ids, m.vote_average, m.runtime, m.certifications,
        bool_or(p.in_group) as in_group_watchlist,
        (select count(*) from user_movies um join participants pt on pt.user_id = um.user_id
          where um.movie_id = m.id and um.status = 'want_to_watch') as wanted_by,
        (select count(*) from user_movies um join participants pt on pt.user_id = um.user_id
          where um.movie_id = m.id and (um.status = 'watched' or um.last_watched_on is not null)) as watched_by
      from pool p
      join ${movies} m on m.id = p.movie_id
      where m.id not in (select movie_id from ${movieNightCandidates} where movie_night_id = ${night.id})
      group by m.id
    `);
    const inputs: SuggestionInput[] = pool.rows.map((row) => ({
      movieId: row.movie_id,
      tmdbId: Number(row.tmdb_id),
      title: row.title,
      genreIds: row.genre_ids ?? [],
      voteAverage: row.vote_average === null ? null : Number(row.vote_average),
      runtime: row.runtime === null ? null : Number(row.runtime),
      certifications: row.certifications ?? {},
      inGroupWatchlist: row.in_group_watchlist,
      wantedBy: Number(row.wanted_by),
      watchedBy: Number(row.watched_by),
    }));
    const ranked = rankSuggestions(inputs, night.criteria, participantIds.length).slice(0, limit);
    const rows = ranked.length
      ? await this.db
          .select()
          .from(movies)
          .where(
            inArray(
              movies.id,
              ranked.map((r) => r.movieId),
            ),
          )
      : [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ranked
      .filter((r) => byId.has(r.movieId))
      .map((r) => ({
        movie: this.card(byId.get(r.movieId)!),
        score: r.score,
        reasons: r.reasons,
        wantedBy: r.wantedBy,
        watchedBy: r.watchedBy,
        inGroupWatchlist: r.inGroupWatchlist,
      }));
  }

  private async context(
    nightId: string,
    userId: string,
    options: { manage?: boolean; statuses?: MovieNightStatus[] } = {},
  ): Promise<Context> {
    const [night] = await this.db.select().from(movieNights).where(eq(movieNights.id, nightId));
    const membership = night ? await this.access.findMembership(night.groupId, userId) : undefined;
    if (!night || !membership) throw notFound('MOVIE_NIGHT_NOT_FOUND', 'Movie night not found.');
    const [participant] = await this.db
      .select({ userId: movieNightParticipants.userId })
      .from(movieNightParticipants)
      .where(
        and(
          eq(movieNightParticipants.movieNightId, nightId),
          eq(movieNightParticipants.userId, userId),
        ),
      );
    const canManage =
      !membership.archived && (night.createdBy === userId || hasRole(membership.role, 'admin'));
    const mutating = options.manage || options.statuses;
    if (mutating && membership.archived)
      throw forbidden('GROUP_ARCHIVED', 'This group is archived.');
    if (options.manage && !canManage) {
      throw forbidden(
        'GROUP_PERMISSION_DENIED',
        'Only the organiser or a group admin can do this.',
      );
    }
    if (options.statuses && !options.statuses.includes(night.status)) {
      throw conflict(
        'INVALID_MOVIE_NIGHT_STATE',
        `Not possible while the movie night is ${night.status}.`,
      );
    }
    return { night, membership, isParticipant: Boolean(participant), canManage };
  }

  /** Validates the requested participants (all must be group members); the organiser is always included. */
  private async validParticipants(
    groupId: string,
    organiserId: string,
    requested?: string[],
  ): Promise<string[]> {
    const memberIds = await this.access.memberIds(groupId);
    if (!requested) return memberIds;
    const unknown = requested.filter((id) => !memberIds.includes(id));
    if (unknown.length > 0) {
      throw badRequest('NOT_GROUP_MEMBERS', 'Participants must be members of the group.', {
        userIds: unknown,
      });
    }
    return [...new Set([organiserId, ...requested])].filter((id) => memberIds.includes(id));
  }

  private async participantIds(nightId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: movieNightParticipants.userId })
      .from(movieNightParticipants)
      .where(eq(movieNightParticipants.movieNightId, nightId));
    return rows.map((row) => row.userId);
  }

  private async summaries(nights: MovieNightRow[]): Promise<MovieNightSummary[]> {
    if (nights.length === 0) return [];
    const ids = nights.map((n) => n.id);
    const selectedIds = nights.flatMap((n) => (n.selectedMovieId ? [n.selectedMovieId] : []));
    const [counts, groupRows, selected, people] = await Promise.all([
      this.db
        .select({
          id: movieNights.id,
          participants:
            sql<number>`(select count(*) from ${movieNightParticipants} p where p.movie_night_id = ${movieNights.id})`.mapWith(
              Number,
            ),
          candidates:
            sql<number>`(select count(*) from ${movieNightCandidates} c where c.movie_night_id = ${movieNights.id})`.mapWith(
              Number,
            ),
        })
        .from(movieNights)
        .where(inArray(movieNights.id, ids)),
      this.db
        .select({ id: groups.id, name: groups.name })
        .from(groups)
        .where(inArray(groups.id, [...new Set(nights.map((n) => n.groupId))])),
      selectedIds.length > 0
        ? this.db.select().from(movies).where(inArray(movies.id, selectedIds))
        : Promise.resolve([]),
      this.directory.people(nights.flatMap((n) => (n.createdBy ? [n.createdBy] : []))),
    ]);
    const countById = new Map(counts.map((c) => [c.id, c]));
    const groupById = new Map(groupRows.map((g) => [g.id, g]));
    const movieById = new Map(selected.map((m) => [m.id, m]));
    return nights.map((night) => ({
      id: night.id,
      group: groupById.get(night.groupId) ?? { id: night.groupId, name: '' },
      title: night.title,
      description: night.description,
      scheduledAt: night.scheduledAt,
      status: night.status,
      decisionMethod: night.decisionMethod,
      selectedMovie:
        night.selectedMovieId && movieById.has(night.selectedMovieId)
          ? this.card(movieById.get(night.selectedMovieId)!)
          : null,
      participantCount: countById.get(night.id)?.participants ?? 0,
      candidateCount: countById.get(night.id)?.candidates ?? 0,
      createdBy: night.createdBy ? (people.get(night.createdBy) ?? null) : null,
      createdAt: night.createdAt,
    }));
  }

  private cleanCriteria(criteria: object | undefined): MovieNightCriteria {
    if (!criteria) return {};
    // Drop undefined fields so the stored JSON only holds what was set.
    return JSON.parse(JSON.stringify(criteria)) as MovieNightCriteria;
  }

  private nightDate(night: MovieNightRow): string {
    const today = todayIsoDate();
    const date = night.scheduledAt ? todayIsoDate(night.scheduledAt) : today;
    return date > today ? today : date;
  }

  private card(row: MovieRow): MovieCard {
    return { ...this.presenter.fromRow(row), runtime: row.runtime };
  }
}
