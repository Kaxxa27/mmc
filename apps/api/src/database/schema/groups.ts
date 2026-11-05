import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, timestamptz, updatedAt } from './columns.js';
import {
  groupKindEnum,
  groupMovieStatusEnum,
  groupRoleEnum,
  invitationKindEnum,
  invitationStatusEnum,
} from './enums.js';
import { movies } from './movies.js';
import { profiles } from './profiles.js';

/** A family or friends space with a shared movie catalog. */
export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    kind: groupKindEnum('kind').notNull().default('family'),
    avatarUrl: text('avatar_url'),
    /** Ownership must be transferred (or the group deleted) before the owner's account is deleted. */
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    archivedAt: timestamptz('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('groups_owner_idx').on(t.ownerId),
    check('groups_name_length', sql`char_length(name) between 1 and 80`),
    check('groups_description_length', sql`char_length(description) <= 500`),
  ],
).enableRLS();

export const groupMembers = pgTable(
  'group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: groupRoleEnum('role').notNull().default('member'),
    joinedAt: timestamptz('joined_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index('group_members_user_idx').on(t.userId),
    uniqueIndex('group_members_single_owner_key')
      .on(t.groupId)
      .where(sql`role = 'owner'`),
  ],
).enableRLS();

/**
 * Email invitations are bound to one address; link invitations can be used by anyone holding
 * the link until they expire, are revoked or reach `max_uses`. Only a SHA-256 hash of the
 * invitation token is stored.
 */
export const groupInvitations = pgTable(
  'group_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    kind: invitationKindEnum('kind').notNull(),
    email: text('email'),
    tokenHash: text('token_hash').notNull(),
    role: groupRoleEnum('role').notNull().default('member'),
    status: invitationStatusEnum('status').notNull().default('pending'),
    maxUses: integer('max_uses'),
    useCount: integer('use_count').notNull().default(0),
    invitedBy: uuid('invited_by').references(() => profiles.id, { onDelete: 'set null' }),
    acceptedBy: uuid('accepted_by').references(() => profiles.id, { onDelete: 'set null' }),
    acceptedAt: timestamptz('accepted_at'),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('group_invitations_token_hash_key').on(t.tokenHash),
    index('group_invitations_group_idx').on(t.groupId),
    index('group_invitations_pending_email_idx')
      .on(t.email)
      .where(sql`status = 'pending'`),
    check('group_invitations_role_not_owner', sql`role <> 'owner'`),
    check('group_invitations_email_kind', sql`(kind = 'email') = (email is not null)`),
    check('group_invitations_max_uses_positive', sql`max_uses is null or max_uses > 0`),
  ],
).enableRLS();

/** The group's shared catalog. Each member's personal status stays in `user_movies`. */
export const groupMovies = pgTable(
  'group_movies',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    status: groupMovieStatusEnum('status').notNull().default('want_to_watch'),
    /** When the group watched the movie together. */
    watchedOn: date('watched_on', { mode: 'string' }),
    note: text('note'),
    addedBy: uuid('added_by').references(() => profiles.id, { onDelete: 'set null' }),
    addedAt: timestamptz('added_at').notNull().defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.movieId] }),
    index('group_movies_group_status_idx').on(t.groupId, t.status),
    check('group_movies_note_length', sql`char_length(note) <= 1000`),
  ],
).enableRLS();

/** Ratings and short reviews members share with their group (separate from personal ratings). */
export const groupMovieRatings = pgTable(
  'group_movie_ratings',
  {
    groupId: uuid('group_id').notNull(),
    movieId: uuid('movie_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    rating: smallint('rating').notNull(),
    review: text('review'),
    containsSpoilers: boolean('contains_spoilers').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.movieId, t.userId] }),
    foreignKey({
      name: 'group_movie_ratings_group_movie_fk',
      columns: [t.groupId, t.movieId],
      foreignColumns: [groupMovies.groupId, groupMovies.movieId],
    }).onDelete('cascade'),
    check('group_movie_ratings_rating_range', sql`rating between 1 and 10`),
    check('group_movie_ratings_review_length', sql`char_length(review) <= 5000`),
  ],
).enableRLS();
