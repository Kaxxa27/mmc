import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './columns.js';
import { groups } from './groups.js';
import { movieNights } from './movie-nights.js';
import { movies } from './movies.js';
import { profiles } from './profiles.js';

/** Group discussions, attached either to a movie in the shared catalog or to a movie night. */
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id').references(() => movies.id, { onDelete: 'cascade' }),
    movieNightId: uuid('movie_night_id').references(() => movieNights.id, {
      onDelete: 'cascade',
    }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('comments_group_movie_idx').on(t.groupId, t.movieId, t.createdAt),
    index('comments_movie_night_idx').on(t.movieNightId, t.createdAt),
    check('comments_body_length', sql`char_length(body) between 1 and 2000`),
    check('comments_single_target', sql`num_nonnulls(movie_id, movie_night_id) = 1`),
  ],
).enableRLS();
