import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';
import { createdAt, timestamptz, updatedAt } from './columns.js';
import type { NotificationType } from './enums.js';

export interface NotificationPreferences {
  /** Per-type override for in-app notifications. Missing keys use the defaults. */
  inApp?: Partial<Record<NotificationType, boolean>>;
  /** Per-type override for email notifications. Missing keys use the defaults. */
  email?: Partial<Record<NotificationType, boolean>>;
}

/** One row per Supabase Auth user. Created by a trigger on `auth.users` insert. */
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    /** Lower-cased copy of `auth.users.email`, kept in sync by a trigger. */
    email: text('email').notNull(),
    username: text('username'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    /** TMDB language code, e.g. `en-US`. */
    language: text('language').notNull().default('en-US'),
    /** ISO 3166-1 alpha-2 region, e.g. `US`. */
    region: text('region').notNull().default('US'),
    favoriteGenreIds: integer('favorite_genre_ids')
      .array()
      .notNull()
      .default(sql`'{}'`),
    notificationPreferences: jsonb('notification_preferences')
      .$type<NotificationPreferences>()
      .notNull()
      .default({}),
    onboardingCompletedAt: timestamptz('onboarding_completed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('profiles_username_key').on(t.username),
    index('profiles_email_idx').on(t.email),
    check('profiles_username_format', sql`username ~ '^[a-z0-9_]{3,30}$'`),
    check('profiles_first_name_length', sql`char_length(first_name) <= 60`),
    check('profiles_last_name_length', sql`char_length(last_name) <= 60`),
    check('profiles_bio_length', sql`char_length(bio) <= 500`),
  ],
).enableRLS();
