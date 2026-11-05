import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { AppConfig } from '../config/app-config.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';

/** `mock`: TMDB answers come from the built-in mock dataset. */
export type CheckStatus = 'up' | 'down' | 'disabled' | 'mock';

export interface HealthReport {
  status: 'ok' | 'degraded' | 'down';
  uptimeSeconds: number;
  checks: Record<string, CheckStatus>;
}

type Probe = () => Promise<CheckStatus>;

@Injectable()
export class HealthService {
  private readonly probes = new Map<string, Probe>();

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly config: AppConfig,
  ) {
    this.register('database', async () => {
      await this.db.execute(sql`select 1`);
      return 'up';
    });
    this.register('auth', async () => {
      const response = await fetch(`${this.config.supabase.url}/auth/v1/health`, {
        headers: { apikey: this.config.supabase.anonKey },
        signal: AbortSignal.timeout(3000),
      });
      return response.ok ? 'up' : 'down';
    });
  }

  /** Lets other modules (e.g. TMDB) contribute a dependency check. */
  register(name: string, probe: Probe): void {
    this.probes.set(name, probe);
  }

  async check(): Promise<HealthReport> {
    const entries = await Promise.all(
      [...this.probes.entries()].map(async ([name, probe]) => {
        try {
          return [name, await probe()] as const;
        } catch {
          return [name, 'down' as const] as const;
        }
      }),
    );
    const checks = Object.fromEntries(entries) as Record<string, CheckStatus>;
    const status =
      checks.database === 'down'
        ? 'down'
        : Object.values(checks).includes('down')
          ? 'degraded'
          : 'ok';
    return { status, uptimeSeconds: Math.round(process.uptime()), checks };
  }
}
