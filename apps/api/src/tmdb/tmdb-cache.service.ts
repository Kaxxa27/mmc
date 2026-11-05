import { Injectable, Logger } from '@nestjs/common';
import { eq, lt, sql } from 'drizzle-orm';
import { AppConfig } from '../config/app-config.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { tmdbCache } from '../database/schema/index.js';
import { TmdbUnavailableError } from './tmdb.client.js';

/** Cache lifetimes in seconds. */
export const CACHE_TTL = {
  list: 60 * 60,
  trending: 30 * 60,
  search: 15 * 60,
  discover: 60 * 60,
  details: 12 * 60 * 60,
  person: 24 * 60 * 60,
  genres: 7 * 24 * 60 * 60,
} as const;

export interface Cached<T> {
  value: T;
  /** When the data was fetched from TMDB. */
  fetchedAt: Date;
}

/**
 * Stores TMDB responses in Postgres. When TMDB is down, an expired entry is still served
 * ("stale-if-error") so pages keep working with slightly older data.
 */
@Injectable()
export class TmdbCacheService {
  private readonly logger = new Logger(TmdbCacheService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly config: AppConfig,
  ) {}

  async getOrFetch<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    return (await this.getOrFetchWithMeta(key, ttlSeconds, fetcher)).value;
  }

  async getOrFetchWithMeta<T>(
    cacheKey: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
  ): Promise<Cached<T>> {
    // Mock responses live in their own namespace, so switching to live TMDB never serves them.
    const key = this.config.tmdb.mock ? `mock:${cacheKey}` : cacheKey;
    const [cached] = await this.db
      .select({
        payload: tmdbCache.payload,
        expiresAt: tmdbCache.expiresAt,
        createdAt: tmdbCache.createdAt,
      })
      .from(tmdbCache)
      .where(eq(tmdbCache.key, key));
    if (cached && cached.expiresAt.getTime() > Date.now()) {
      return { value: cached.payload as T, fetchedAt: cached.createdAt };
    }

    try {
      const value = await fetcher();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
      await this.db
        .insert(tmdbCache)
        .values({ key, payload: value, expiresAt, createdAt: now })
        .onConflictDoUpdate({
          target: tmdbCache.key,
          set: { payload: value, expiresAt, createdAt: now },
        });
      return { value, fetchedAt: now };
    } catch (error) {
      if (cached && error instanceof TmdbUnavailableError) {
        this.logger.warn(`Serving stale TMDB data for ${key}: ${error.message}`);
        return { value: cached.payload as T, fetchedAt: cached.createdAt };
      }
      throw error;
    }
  }

  /** Deletes entries that expired more than a week ago (kept briefly for stale fallbacks). */
  async purgeExpired(): Promise<number> {
    const deleted = await this.db
      .delete(tmdbCache)
      .where(lt(tmdbCache.expiresAt, sql`now() - interval '7 days'`))
      .returning({ key: tmdbCache.key });
    return deleted.length;
  }
}
