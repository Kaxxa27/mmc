import { bigint, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, timestamptz, updatedAt } from './columns.js';

/** Fixed-window counters used for rate limiting (works across restarts and instances). */
export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    key: text('key').primaryKey(),
    hits: integer('hits').notNull().default(0),
    windowStartedAt: timestamptz('window_started_at').notNull().defaultNow(),
  },
  (t) => [index('rate_limit_buckets_window_idx').on(t.windowStartedAt)],
).enableRLS();

/**
 * Passwordless sign-in state per email address (keyed by a SHA-256 hash of the address):
 * when the last code was sent and how many wrong codes were entered since.
 */
export const authOtpState = pgTable('auth_otp_state', {
  emailHash: text('email_hash').primaryKey(),
  lastSentAt: timestamptz('last_sent_at').notNull(),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  updatedAt: updatedAt(),
}).enableRLS();

/** Append-only record of security-relevant and administrative actions. */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    /** No foreign key on purpose: audit entries outlive deleted accounts. */
    actorId: uuid('actor_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text('ip_address'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_events_actor_idx').on(t.actorId, t.createdAt),
    index('audit_events_entity_idx').on(t.entityType, t.entityId),
  ],
).enableRLS();
