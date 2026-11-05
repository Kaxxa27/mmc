import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { asc, isNull, like, or } from 'drizzle-orm';
import { AppConfig } from '../config/app-config.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { movies } from '../database/schema/index.js';
import { TmdbClient } from '../tmdb/tmdb.client.js';
import { GenresService } from './genres.service.js';
import { MovieStore } from './movie-store.service.js';

/**
 * After startup, completes the bundled sample movies (posters, cast, trailers) from TMDB (or the
 * mock dataset) and syncs genre names. With live TMDB it also replaces movies that were saved
 * while the mock dataset was in use.
 */
@Injectable()
export class SampleMoviesRefresher implements OnApplicationBootstrap {
  private readonly logger = new Logger(SampleMoviesRefresher.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly tmdb: TmdbClient,
    private readonly store: MovieStore,
    private readonly genres: GenresService,
    private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.tmdb.enabled || this.config.isTest) return;
    void this.refresh().catch((error: unknown) =>
      this.logger.warn(`Background refresh failed: ${(error as Error).message}`),
    );
  }

  private async refresh(): Promise<void> {
    await this.genres.syncFromTmdb();
    const pending = await this.db
      .select({ tmdbId: movies.tmdbId })
      .from(movies)
      .where(
        this.tmdb.mock
          ? isNull(movies.detailsFetchedAt)
          : or(isNull(movies.detailsFetchedAt), like(movies.posterPath, '/mock/%')),
      )
      .orderBy(asc(movies.tmdbId))
      .limit(200);
    let refreshed = 0;
    for (const { tmdbId } of pending) {
      try {
        const { value } = await this.store.fetchDetails(tmdbId, this.config.tmdb.defaultLanguage);
        await this.store.upsertDetails(value);
        refreshed += 1;
      } catch (error) {
        this.logger.warn(`Could not refresh movie ${tmdbId}: ${(error as Error).message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (refreshed > 0) this.logger.log(`Refreshed ${refreshed} movies with TMDB details.`);
  }
}
