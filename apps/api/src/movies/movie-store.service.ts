import { Injectable, Logger } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { notFound, serviceUnavailable } from '../common/errors.js';
import { AppConfig } from '../config/app-config.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { movies } from '../database/schema/index.js';
import { CACHE_TTL, type Cached, TmdbCacheService } from '../tmdb/tmdb-cache.service.js';
import { TmdbClient, TmdbNotFoundError, TmdbUnavailableError } from '../tmdb/tmdb.client.js';
import type { TmdbMovieDetails } from '../tmdb/tmdb.types.js';
import { extractCertifications } from './certifications.js';
import type { MovieRow } from './movie.types.js';

const APPEND =
  'credits,videos,release_dates,similar,recommendations,watch/providers,alternative_titles';
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;

/**
 * The global movie catalog (`movies` table). A movie is imported from TMDB the first time
 * anyone saves or opens it, so every user and group references the same row.
 */
@Injectable()
export class MovieStore {
  private readonly logger = new Logger(MovieStore.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly tmdb: TmdbClient,
    private readonly cache: TmdbCacheService,
    private readonly config: AppConfig,
  ) {}

  async findByTmdbId(tmdbId: number): Promise<MovieRow | undefined> {
    const [row] = await this.db.select().from(movies).where(eq(movies.tmdbId, tmdbId));
    return row;
  }

  async findByTmdbIds(tmdbIds: number[]): Promise<MovieRow[]> {
    if (tmdbIds.length === 0) return [];
    return this.db.select().from(movies).where(inArray(movies.tmdbId, tmdbIds));
  }

  /** Returns the stored movie, importing it from TMDB if nobody has used it yet. */
  async ensure(tmdbId: number): Promise<MovieRow> {
    const existing = await this.findByTmdbId(tmdbId);
    if (existing) return existing;
    try {
      const { value } = await this.fetchDetails(tmdbId, this.config.tmdb.defaultLanguage);
      return await this.upsertDetails(value);
    } catch (error) {
      throw this.translate(error);
    }
  }

  /** Full TMDB details (cached), in the given language. */
  async fetchDetails(tmdbId: number, language: string): Promise<Cached<TmdbMovieDetails>> {
    const videoLanguages = [...new Set([language.slice(0, 2), 'en'])].join(',');
    return this.cache.getOrFetchWithMeta(`movie:${tmdbId}:${language}`, CACHE_TTL.details, () =>
      this.tmdb.get<TmdbMovieDetails>(`/movie/${tmdbId}`, {
        language,
        append_to_response: APPEND,
        include_video_language: `${videoLanguages},null`,
      }),
    );
  }

  /** Stores details fetched in the default language unless the row is already fresh. */
  async rememberDetails(details: TmdbMovieDetails): Promise<MovieRow> {
    const existing = await this.findByTmdbId(details.id);
    if (
      existing?.detailsFetchedAt &&
      Date.now() - existing.detailsFetchedAt.getTime() < REFRESH_AFTER_MS
    ) {
      return existing;
    }
    return this.upsertDetails(details);
  }

  async upsertDetails(details: TmdbMovieDetails): Promise<MovieRow> {
    const values = {
      tmdbId: details.id,
      imdbId: details.imdb_id ?? null,
      title: details.title,
      originalTitle: details.original_title ?? null,
      originalLanguage: details.original_language ?? null,
      overview: details.overview ? details.overview : null,
      tagline: details.tagline ? details.tagline : null,
      releaseDate: details.release_date ? details.release_date : null,
      runtime: details.runtime ? details.runtime : null,
      releaseStatus: details.status ?? null,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      genreIds: details.genres.map((g) => g.id),
      originCountries:
        details.origin_country ?? details.production_countries.map((c) => c.iso_3166_1),
      popularity: details.popularity,
      voteAverage: details.vote_average,
      voteCount: details.vote_count,
      adult: details.adult,
      certifications: extractCertifications(details.release_dates),
      detailsFetchedAt: new Date(),
    };
    const [row] = await this.db
      .insert(movies)
      .values(values)
      .onConflictDoUpdate({ target: movies.tmdbId, set: values })
      .returning();
    if (!row) throw new Error(`Could not store movie ${details.id}`);
    return row;
  }

  /** Converts TMDB errors into API errors for user-facing actions. */
  translate(error: unknown): unknown {
    if (error instanceof TmdbNotFoundError) return notFound('MOVIE_NOT_FOUND', 'Movie not found.');
    if (error instanceof TmdbUnavailableError) {
      this.logger.warn(error.message);
      return serviceUnavailable(
        'MOVIE_DATA_UNAVAILABLE',
        this.tmdb.enabled
          ? 'Movie information is temporarily unavailable. Please try again.'
          : 'This movie is not in the offline catalog. Configure a TMDB key to use the full catalog.',
      );
    }
    return error;
  }
}
