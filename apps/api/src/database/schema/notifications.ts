import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, timestamptz } from './columns.js';
import { notificationTypeEnum } from './enums.js';
import { profiles } from './profiles.js';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    /** Identifiers the client needs to deep-link (groupId, movieNightId, tmdbId, ...). */
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    /** Prevents duplicates for system notifications (e.g. release reminders). */
    dedupeKey: text('dedupe_key'),
    readAt: timestamptz('read_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_user_created_idx').on(t.userId, t.createdAt.desc()),
    index('notifications_user_unread_idx')
      .on(t.userId)
      .where(sql`read_at is null`),
    uniqueIndex('notifications_user_dedupe_key').on(t.userId, t.dedupeKey),
  ],
).enableRLS();
