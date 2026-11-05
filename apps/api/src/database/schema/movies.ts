import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, timestamptz, updatedAt } from './columns.js';
import { profiles } from './profiles.js';

/** TMDB movie genres (reference data, ids are TMDB ids). */
export const genres = pgTable('genres', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  updatedAt: updatedAt(),
}).enableRLS();

/**
 * Global movie catalog: one row per TMDB movie that any user has saved or opened.
 * Personal data never lives here; it references this table instead.
 */
export const movies = pgTable(
  'movies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tmdbId: integer('tmdb_id').notNull(),
    imdbId: text('imdb_id'),
    title: text('title').notNull(),
    originalTitle: text('original_title'),
    originalLanguage: text('original_language'),
    overview: text('overview'),
    tagline: text('tagline'),
    releaseDate: date('release_date', { mode: 'string' }),
    runtime: integer('runtime'),
    /** TMDB release status, e.g. `Released`, `In Production`. */
    releaseStatus: text('release_status'),
    posterPath: text('poster_path'),
    backdropPath: text('backdrop_path'),
    genreIds: integer('genre_ids')
      .array()
      .notNull()
      .default(sql`'{}'`),
    originCountries: text('origin_countries')
      .array()
      .notNull()
      .default(sql`'{}'`),
    popularity: real('popularity'),
    voteAverage: real('vote_average'),
    voteCount: integer('vote_count'),
    adult: boolean('adult').notNull().default(false),
    /** Age certification per region, e.g. `{ "US": "PG-13", "GB": "12A" }`. */
    certifications: jsonb('certifications').$type<Record<string, string>>().notNull().default({}),
    /** Rows from the bundled offline sample (supabase/seed.sql). */
    isSample: boolean('is_sample').notNull().default(false),
    /** When full details were last fetched from TMDB. `null` = summary data only. */
    detailsFetchedAt: timestamptz('details_fetched_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('movies_tmdb_id_key').on(t.tmdbId),
    index('movies_genre_ids_idx').using('gin', t.genreIds),
    index('movies_release_date_idx').on(t.releaseDate),
  ],
).enableRLS();

/** Cache of raw TMDB responses (lists, searches, details) to limit external requests. */
export const tmdbCache = pgTable(
  'tmdb_cache',
  {
    key: text('key').primaryKey(),
    payload: jsonb('payload').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('tmdb_cache_expires_at_idx').on(t.expiresAt)],
).enableRLS();

/** Movies a user recently opened; powers "Continue exploring". */
export const movieViews = pgTable(
  'movie_views',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    viewCount: integer('view_count').notNull().default(1),
    lastViewedAt: timestamptz('last_viewed_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.movieId] }),
    index('movie_views_user_recent_idx').on(t.userId, t.lastViewedAt.desc()),
  ],
).enableRLS();
