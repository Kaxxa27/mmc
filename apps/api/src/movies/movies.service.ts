import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { notFound } from '../common/errors.js';
import { todayIsoDate } from '../common/utils/dates.js';
import { AppConfig } from '../config/app-config.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { movieViews } from '../database/schema/index.js';
import { CACHE_TTL, TmdbCacheService } from '../tmdb/tmdb-cache.service.js';
import {
  type TmdbParams,
  TmdbClient,
  TmdbNotFoundError,
  TmdbUnavailableError,
} from '../tmdb/tmdb.client.js';
import type { TmdbMovieListItem, TmdbPaged } from '../tmdb/tmdb.types.js';
import { buildDiscoverParams, type DiscoverFilters, discoverCacheKey } from './discover-filters.js';
import { LocalCatalogService, type MovieListKind } from './local-catalog.service.js';
import type { Locale } from './locale.service.js';
import { MovieStore } from './movie-store.service.js';
import { MoviePresenter } from './movie.presenter.js';
import type { MovieDetails, MovieListResult } from './movie.types.js';
import { UserMovieStateService } from './user-movie-state.service.js';

const LIST_PATHS: Record<Exclude<MovieListKind, 'trending'>, string> = {
  popular: '/movie/popular',
  'top-rated': '/movie/top_rated',
  upcoming: '/movie/upcoming',
  'now-playing': '/movie/now_playing',
};

/** TMDB caps list pagination at 500 pages. */
const MAX_TMDB_PAGE = 500;

/**
 * Global movie discovery. Uses TMDB (cached) when configured and falls back to the local
 * catalog when it is not or when TMDB is unreachable.
 */
@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly tmdb: TmdbClient,
    private readonly cache: TmdbCacheService,
    private readonly store: MovieStore,
    private readonly local: LocalCatalogService,
    private readonly presenter: MoviePresenter,
    private readonly userStates: UserMovieStateService,
    private readonly config: AppConfig,
  ) {}

  async list(
    kind: MovieListKind,
    options: { page: number; locale: Locale; window?: 'day' | 'week'; userId?: string },
  ): Promise<MovieListResult> {
    const { page, locale } = options;
    const result = await this.withFallback(
      () => {
        if (kind === 'trending') {
          const window = options.window ?? 'week';
          return this.tmdbPage(
            `trending:${window}:${locale.language}:${page}`,
            CACHE_TTL.trending,
            `/trending/movie/${window}`,
            { language: locale.language, page },
          );
        }
        const regional = kind === 'upcoming' || kind === 'now-playing';
        return this.tmdbPage(
          `list:${kind}:${locale.language}:${regional ? locale.region : '-'}:${page}`,
          CACHE_TTL.list,
          LIST_PATHS[kind],
          { language: locale.language, page, region: regional ? locale.region : undefined },
        );
      },
      () => this.local.list(kind, page),
    );
    return this.annotate(result, options.userId);
  }

  async search(options: {
    query: string;
    year?: number;
    page: number;
    locale: Locale;
    userId?: string;
  }): Promise<MovieListResult> {
    const { query, year, page, locale } = options;
    const result = await this.withFallback(
      () =>
        this.tmdbPage(
          `search:${locale.language}:${year ?? '-'}:${page}:${query.toLowerCase()}`,
          CACHE_TTL.search,
          '/search/movie',
          { query, year, page, language: locale.language, include_adult: false },
        ),
      () => this.local.search(query, year, page),
    );
    return this.annotate(result, options.userId);
  }

  async discover(
    filters: DiscoverFilters,
    options: { page: number; locale: Locale; userId?: string },
  ): Promise<MovieListResult> {
    const params: TmdbParams = {
      ...buildDiscoverParams(filters, todayIsoDate()),
      language: options.locale.language,
      page: options.page,
    };
    const result = await this.withFallback(
      () =>
        this.tmdbPage(
          `discover:${discoverCacheKey(params)}`,
          CACHE_TTL.discover,
          '/discover/movie',
          params,
        ),
      () => this.local.discover(filters, options.page),
    );
    return this.annotate(result, options.userId);
  }

  async details(
    tmdbId: number,
    options: { locale: Locale; userId?: string },
  ): Promise<MovieDetails> {
    const { locale } = options;
    let details: MovieDetails;
    let movieId: string | undefined;

    if (this.tmdb.enabled) {
      try {
        const { value, fetchedAt } = await this.store.fetchDetails(tmdbId, locale.language);
        details = this.presenter.fromTmdbDetails(value, locale.region, fetchedAt);
        // The shared catalog keeps the default-language version of each movie.
        const row =
          locale.language === this.config.tmdb.defaultLanguage
            ? await this.store.rememberDetails(value)
            : await this.store.findByTmdbId(tmdbId);
        movieId = row?.id;
      } catch (error) {
        if (error instanceof TmdbNotFoundError)
          throw notFound('MOVIE_NOT_FOUND', 'Movie not found.');
        if (!(error instanceof TmdbUnavailableError)) throw error;
        this.logger.warn(`Showing offline details for ${tmdbId}: ${error.message}`);
        details = await this.localDetails(tmdbId, locale);
      }
    } else {
      details = await this.localDetails(tmdbId, locale);
    }

    if (options.userId) {
      movieId ??= (await this.store.findByTmdbId(tmdbId))?.id;
      if (movieId) await this.recordView(options.userId, movieId);
      const [annotated] = await this.userStates.annotate(options.userId, [details]);
      details = annotated ?? details;
      details.similar = await this.userStates.annotate(options.userId, details.similar);
      details.recommendations = await this.userStates.annotate(
        options.userId,
        details.recommendations,
      );
    }
    return details;
  }

  async similar(
    tmdbId: number,
    options: { page: number; locale: Locale; userId?: string },
  ): Promise<MovieListResult> {
    const result = await this.withFallback(
      () =>
        this.tmdbPage(
          `similar:${tmdbId}:${options.locale.language}:${options.page}`,
          CACHE_TTL.list,
          `/movie/${tmdbId}/similar`,
          { language: options.locale.language, page: options.page },
        ),
      async () => {
        const row = await this.store.findByTmdbId(tmdbId);
        if (!row) throw notFound('MOVIE_NOT_FOUND', 'Movie not found.');
        const items = options.page === 1 ? await this.local.similar(row, 20) : [];
        return {
          items,
          page: options.page,
          totalPages: 1,
          totalResults: items.length,
          source: 'local' as const,
        };
      },
    );
    return this.annotate(result, options.userId);
  }

  /** Remembers what the user explored recently ("Continue exploring"). */
  private async recordView(userId: string, movieId: string): Promise<void> {
    await this.db
      .insert(movieViews)
      .values({ userId, movieId })
      .onConflictDoUpdate({
        target: [movieViews.userId, movieViews.movieId],
        set: { viewCount: sql`${movieViews.viewCount} + 1`, lastViewedAt: sql`now()` },
      });
  }

  private async localDetails(tmdbId: number, locale: Locale): Promise<MovieDetails> {
    const row = await this.store.findByTmdbId(tmdbId);
    if (!row) throw this.store.translate(new TmdbUnavailableError('not in local catalog'));
    return this.presenter.fromRowDetails(row, locale.region, await this.local.similar(row));
  }

  private async tmdbPage(
    cacheKey: string,
    ttl: number,
    path: string,
    params: TmdbParams,
  ): Promise<MovieListResult> {
    const page = Number(params.page ?? 1);
    if (page > MAX_TMDB_PAGE)
      return { items: [], page, totalPages: MAX_TMDB_PAGE, totalResults: 0, source: 'tmdb' };
    const data = await this.cache.getOrFetch(cacheKey, ttl, () =>
      this.tmdb.get<TmdbPaged<TmdbMovieListItem>>(path, params),
    );
    return {
      items: data.results.filter((m) => !m.adult).map((m) => this.presenter.fromTmdbItem(m)),
      page: data.page,
      totalPages: Math.min(data.total_pages, MAX_TMDB_PAGE),
      totalResults: data.total_results,
      source: 'tmdb',
    };
  }

  private async withFallback(
    fromTmdb: () => Promise<MovieListResult>,
    fromLocal: () => Promise<MovieListResult>,
  ): Promise<MovieListResult> {
    if (!this.tmdb.enabled) return fromLocal();
    try {
      return await fromTmdb();
    } catch (error) {
      if (!(error instanceof TmdbUnavailableError)) throw error;
      this.logger.warn(`TMDB unavailable, using the local catalog: ${error.message}`);
      return fromLocal();
    }
  }

  private async annotate(
    result: MovieListResult,
    userId: string | undefined,
  ): Promise<MovieListResult> {
    return { ...result, items: await this.userStates.annotate(userId, result.items) };
  }
}
