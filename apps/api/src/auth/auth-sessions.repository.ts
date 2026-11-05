import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';

export interface ActiveSession {
  id: string;
  createdAt: Date;
  lastActiveAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}

/** Read/revoke access to Supabase Auth sessions (`auth.sessions`, owned by Supabase). */
@Injectable()
export class AuthSessionsRepository {
  constructor(@InjectDb() private readonly db: Database) {}

  /** A session stays usable until it is signed out, revoked or past its `not_after`. */
  async isActive(sessionId: string, userId: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      select 1 from auth.sessions
      where id = ${sessionId}::uuid and user_id = ${userId}::uuid
        and (not_after is null or not_after > now())
      limit 1
    `);
    return result.rows.length > 0;
  }

  async list(userId: string): Promise<ActiveSession[]> {
    const result = await this.db.execute<{
      id: string;
      created_at: string;
      last_active_at: string;
      user_agent: string | null;
      ip: string | null;
    }>(sql`
      select id, created_at,
        greatest(created_at, updated_at, refreshed_at at time zone 'utc') as last_active_at,
        user_agent, host(ip) as ip
      from auth.sessions
      where user_id = ${userId}::uuid and (not_after is null or not_after > now())
      order by last_active_at desc
    `);
    return result.rows.map((row) => ({
      id: row.id,
      createdAt: new Date(row.created_at),
      lastActiveAt: new Date(row.last_active_at),
      userAgent: row.user_agent,
      ipAddress: row.ip,
    }));
  }

  /** Deletes the session and (by cascade) its refresh tokens. */
  async revoke(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      delete from auth.sessions where id = ${sessionId}::uuid and user_id = ${userId}::uuid
    `);
    return (result.rowCount ?? 0) > 0;
  }
}
