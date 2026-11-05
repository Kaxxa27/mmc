import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, timestamptz, updatedAt } from './columns.js';
import { collectionVisibilityEnum } from './enums.js';
import { groups } from './groups.js';
import { movies } from './movies.js';
import { profiles } from './profiles.js';

/**
 * Custom collections. A personal collection (`group_id` is null) is controlled by its owner
 * and its `visibility`; a group collection belongs to a group and is editable by its members.
 */
export const collections = pgTable(
  'collections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    coverImageUrl: text('cover_image_url'),
    visibility: collectionVisibilityEnum('visibility').notNull().default('private'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('collections_owner_idx').on(t.ownerId),
    index('collections_group_idx').on(t.groupId),
    check('collections_name_length', sql`char_length(name) between 1 and 100`),
    check('collections_description_length', sql`char_length(description) <= 1000`),
  ],
).enableRLS();

export const collectionItems = pgTable(
  'collection_items',
  {
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    note: text('note'),
    addedBy: uuid('added_by').references(() => profiles.id, { onDelete: 'set null' }),
    addedAt: timestamptz('added_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.movieId] }),
    index('collection_items_position_idx').on(t.collectionId, t.position),
    check('collection_items_note_length', sql`char_length(note) <= 500`),
  ],
).enableRLS();

/** Read access for `shared` collections: a whole group or a single user. */
export const collectionShares = pgTable(
  'collection_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('collection_shares_group_key').on(t.collectionId, t.groupId),
    uniqueIndex('collection_shares_user_key').on(t.collectionId, t.userId),
    index('collection_shares_group_idx').on(t.groupId),
    index('collection_shares_user_idx').on(t.userId),
    check('collection_shares_single_target', sql`num_nonnulls(group_id, user_id) = 1`),
  ],
).enableRLS();
