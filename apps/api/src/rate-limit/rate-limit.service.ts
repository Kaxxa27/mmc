import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';

export interface RateLimitResult {
  allowed: boolean;
  hits: number;
  limit: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limiting stored in Postgres, so limits survive restarts and are shared by
 * every API instance. Used for sensitive endpoints (sign-in codes); general traffic is limited
 * in memory by RequestThrottleGuard.
 */
@Injectable()
export class RateLimitService {
  constructor(@InjectDb() private readonly db: Database) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const result = await this.db.execute<{ hits: number; window_started_at: string | Date }>(sql`
      insert into rate_limit_buckets as b (key, hits, window_started_at)
      values (${key}, 1, now())
      on conflict (key) do update set
        hits = case
          when b.window_started_at <= now() - make_interval(secs => ${windowSeconds}) then 1
          else b.hits + 1
        end,
        window_started_at = case
          when b.window_started_at <= now() - make_interval(secs => ${windowSeconds}) then now()
          else b.window_started_at
        end
      returning hits, window_started_at
    `);
    const row = result.rows[0];
    if (!row) throw new Error('Rate limit upsert returned no row');
    const windowEndsAt = new Date(row.window_started_at).getTime() + windowSeconds * 1000;
    const retryAfterSeconds = Math.max(0, Math.ceil((windowEndsAt - Date.now()) / 1000));
    return { allowed: row.hits <= limit, hits: row.hits, limit, retryAfterSeconds };
  }

  async reset(key: string): Promise<void> {
    await this.db.execute(sql`delete from rate_limit_buckets where key = ${key}`);
  }

  /** Removes windows that ended more than a day ago. */
  async purgeExpired(): Promise<number> {
    const result = await this.db.execute(
      sql`delete from rate_limit_buckets where window_started_at < now() - interval '1 day'`,
    );
    return result.rowCount ?? 0;
  }
}
