import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, timestamptz, updatedAt } from './columns.js';
import { decisionMethodEnum, movieNightStatusEnum } from './enums.js';
import { groups } from './groups.js';
import { movies } from './movies.js';
import { profiles } from './profiles.js';

export type WatchedFilter = 'any' | 'all' | 'none';

/** Filters used to build the movie-night shortlist. All fields are optional. */
export interface MovieNightCriteria {
  genreIds?: number[];
  /** Minimum TMDB average rating (0–10). */
  minRating?: number;
  /** Maximum runtime in minutes. */
  maxRuntime?: number;
  /** Highest allowed age certification, e.g. `PG-13` (see `certificationCountry`). */
  maxCertification?: string;
  certificationCountry?: string;
  /**
   * `all` (default): skip movies every participant has watched.
   * `any`: skip movies any participant has watched. `none`: keep everything.
   */
  excludeWatchedBy?: WatchedFilter;
  /** Also consider movies on participants' personal watchlists. */
  includeParticipantWatchlists?: boolean;
}

export const movieNights = pgTable(
  'movie_nights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    scheduledAt: timestamptz('scheduled_at'),
    status: movieNightStatusEnum('status').notNull().default('planning'),
    criteria: jsonb('criteria').$type<MovieNightCriteria>().notNull().default({}),
    selectedMovieId: uuid('selected_movie_id').references(() => movies.id, {
      onDelete: 'set null',
    }),
    decisionMethod: decisionMethodEnum('decision_method'),
    decidedAt: timestamptz('decided_at'),
    decidedBy: uuid('decided_by').references(() => profiles.id, { onDelete: 'set null' }),
    votingStartedAt: timestamptz('voting_started_at'),
    completedAt: timestamptz('completed_at'),
    cancelledAt: timestamptz('cancelled_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('movie_nights_group_schedule_idx').on(t.groupId, t.scheduledAt),
    check('movie_nights_title_length', sql`char_length(title) between 1 and 120`),
    check('movie_nights_description_length', sql`char_length(description) <= 1000`),
  ],
).enableRLS();

export const movieNightParticipants = pgTable(
  'movie_night_participants',
  {
    movieNightId: uuid('movie_night_id')
      .notNull()
      .references(() => movieNights.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    joinedAt: timestamptz('joined_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.movieNightId, t.userId] }),
    index('movie_night_participants_user_idx').on(t.userId),
  ],
).enableRLS();

export const movieNightCandidates = pgTable(
  'movie_night_candidates',
  {
    movieNightId: uuid('movie_night_id')
      .notNull()
      .references(() => movieNights.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    addedBy: uuid('added_by').references(() => profiles.id, { onDelete: 'set null' }),
    addedAt: timestamptz('added_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.movieNightId, t.movieId] })],
).enableRLS();

/** One vote per participant; it can be changed until voting closes. */
export const movieNightVotes = pgTable(
  'movie_night_votes',
  {
    movieNightId: uuid('movie_night_id').notNull(),
    userId: uuid('user_id').notNull(),
    movieId: uuid('movie_id').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.movieNightId, t.userId] }),
    foreignKey({
      name: 'movie_night_votes_candidate_fk',
      columns: [t.movieNightId, t.movieId],
      foreignColumns: [movieNightCandidates.movieNightId, movieNightCandidates.movieId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'movie_night_votes_participant_fk',
      columns: [t.movieNightId, t.userId],
      foreignColumns: [movieNightParticipants.movieNightId, movieNightParticipants.userId],
    }).onDelete('cascade'),
  ],
).enableRLS();
