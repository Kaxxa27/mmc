import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, timestamptz, updatedAt } from './columns.js';
import { movieStatusEnum } from './enums.js';
import { movieNights } from './movie-nights.js';
import { movies } from './movies.js';
import { profiles } from './profiles.js';

/** A user's personal relationship with a movie (status, favorite, rating, private notes). */
export const userMovies = pgTable(
  'user_movies',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    /** `null` = saved without a viewing status (e.g. only marked as favorite). */
    status: movieStatusEnum('status'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    rating: smallint('rating'),
    /** Private notes; never shown to anyone else. */
    notes: text('notes'),
    /** Latest `watch_events.watched_on` (denormalized for sorting). */
    lastWatchedOn: date('last_watched_on', { mode: 'string' }),
    statusChangedAt: timestamptz('status_changed_at'),
    addedAt: timestamptz('added_at').notNull().defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.movieId] }),
    index('user_movies_user_status_idx').on(t.userId, t.status),
    index('user_movies_user_added_idx').on(t.userId, t.addedAt.desc()),
    index('user_movies_movie_idx').on(t.movieId),
    check('user_movies_rating_range', sql`rating between 1 and 10`),
    check('user_movies_notes_length', sql`char_length(notes) <= 2000`),
  ],
).enableRLS();

/** Viewing history: one row per viewing (rewatches create new rows). */
export const watchEvents = pgTable(
  'watch_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    watchedOn: date('watched_on', { mode: 'string' }).notNull(),
    rating: smallint('rating'),
    notes: text('notes'),
    isRewatch: boolean('is_rewatch').notNull().default(false),
    movieNightId: uuid('movie_night_id').references(() => movieNights.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('watch_events_user_date_idx').on(t.userId, t.watchedOn.desc()),
    index('watch_events_user_movie_idx').on(t.userId, t.movieId),
    check('watch_events_rating_range', sql`rating between 1 and 10`),
    check('watch_events_notes_length', sql`char_length(notes) <= 2000`),
  ],
).enableRLS();

/** Personal reviews: private by default, optionally published. One per user and movie. */
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    rating: smallint('rating'),
    containsSpoilers: boolean('contains_spoilers').notNull().default(false),
    isPublic: boolean('is_public').notNull().default(false),
    publishedAt: timestamptz('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('reviews_user_movie_key').on(t.userId, t.movieId),
    index('reviews_public_movie_idx')
      .on(t.movieId, t.publishedAt)
      .where(sql`is_public`),
    check('reviews_rating_range', sql`rating between 1 and 10`),
    check('reviews_body_length', sql`char_length(body) between 1 and 10000`),
  ],
).enableRLS();
