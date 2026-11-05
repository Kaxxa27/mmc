import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { AppConfig } from '../config/app-config.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { genres } from '../database/schema/index.js';
import { CACHE_TTL, TmdbCacheService } from '../tmdb/tmdb-cache.service.js';
import { TmdbClient, TmdbUnavailableError } from '../tmdb/tmdb.client.js';
import type { TmdbGenre } from '../tmdb/tmdb.types.js';
import type { GenreRef } from './movie.types.js';

/** Genre names by id (kept in memory; the list is tiny and rarely changes). */
@Injectable()
export class GenresService implements OnModuleInit {
  private readonly logger = new Logger(GenresService.name);
  private names = new Map<number, string>();

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly tmdb: TmdbClient,
    private readonly cache: TmdbCacheService,
    private readonly config: AppConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    const rows = await this.db.select().from(genres).orderBy(asc(genres.name));
    this.names = new Map(rows.map((row) => [row.id, row.name]));
  }

  refs(ids: readonly number[]): GenreRef[] {
    return ids.map((id) => ({ id, name: this.names.get(id) ?? 'Unknown' }));
  }

  has(id: number): boolean {
    return this.names.has(id);
  }

  /** Genres in the requested language (TMDB), falling back to the stored English names. */
  async list(language: string): Promise<GenreRef[]> {
    if (this.tmdb.enabled) {
      try {
        const result = await this.cache.getOrFetch(`genres:${language}`, CACHE_TTL.genres, () =>
          this.tmdb.get<{ genres: TmdbGenre[] }>('/genre/movie/list', { language }),
        );
        return result.genres.map(({ id, name }) => ({ id, name }));
      } catch (error) {
        if (!(error instanceof TmdbUnavailableError)) throw error;
      }
    }
    return [...this.names.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Syncs the stored (default-language) genre names with TMDB. */
  async syncFromTmdb(): Promise<void> {
    if (!this.tmdb.enabled) return;
    try {
      const result = await this.tmdb.get<{ genres: TmdbGenre[] }>('/genre/movie/list', {
        language: this.config.tmdb.defaultLanguage,
      });
      for (const genre of result.genres) {
        await this.db
          .insert(genres)
          .values({ id: genre.id, name: genre.name })
          .onConflictDoUpdate({ target: genres.id, set: { name: genre.name } });
      }
      await this.reload();
    } catch (error) {
      this.logger.warn(`Could not sync genres from TMDB: ${(error as Error).message}`);
    }
  }
}
