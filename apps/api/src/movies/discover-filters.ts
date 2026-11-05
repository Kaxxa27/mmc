import type { TmdbParams } from '../tmdb/tmdb.client.js';

export const DISCOVER_SORTS = ['popularity', 'rating', 'newest', 'oldest', 'title'] as const;
export type DiscoverSort = (typeof DISCOVER_SORTS)[number];

export interface DiscoverFilters {
  genreIds?: number[];
  /** `any` (default): at least one genre; `all`: every genre. */
  genreMatch?: 'any' | 'all';
  yearFrom?: number;
  yearTo?: number;
  originalLanguage?: string;
  originCountry?: string;
  minRating?: number;
  maxRating?: number;
  minVotes?: number;
  minRuntime?: number;
  maxRuntime?: number;
  certificationCountry?: string;
  maxCertification?: string;
  castIds?: number[];
  crewIds?: number[];
  releaseState?: 'released' | 'upcoming';
  sort?: DiscoverSort;
}

const SORT_PARAM: Record<DiscoverSort, string> = {
  popularity: 'popularity.desc',
  rating: 'vote_average.desc',
  newest: 'primary_release_date.desc',
  oldest: 'primary_release_date.asc',
  title: 'title.asc',
};

/** Translates the API's discover filters into TMDB `/discover/movie` parameters. */
export function buildDiscoverParams(filters: DiscoverFilters, today: string): TmdbParams {
  const sort = filters.sort ?? 'popularity';
  let releaseFrom = filters.yearFrom ? `${filters.yearFrom}-01-01` : undefined;
  let releaseTo = filters.yearTo ? `${filters.yearTo}-12-31` : undefined;
  if (filters.releaseState === 'released' && (!releaseTo || releaseTo > today)) releaseTo = today;
  if (filters.releaseState === 'upcoming' && (!releaseFrom || releaseFrom < today))
    releaseFrom = today;

  return {
    sort_by: SORT_PARAM[sort],
    include_adult: false,
    include_video: false,
    with_genres: filters.genreIds?.join(filters.genreMatch === 'all' ? ',' : '|'),
    'primary_release_date.gte': releaseFrom,
    'primary_release_date.lte': releaseTo,
    with_original_language: filters.originalLanguage,
    with_origin_country: filters.originCountry,
    'vote_average.gte': filters.minRating,
    'vote_average.lte': filters.maxRating,
    // Rating-sorted results are dominated by obscure titles without a minimum vote count.
    'vote_count.gte': filters.minVotes ?? (sort === 'rating' ? 200 : undefined),
    'with_runtime.gte': filters.minRuntime,
    'with_runtime.lte': filters.maxRuntime,
    certification_country: filters.maxCertification
      ? (filters.certificationCountry ?? 'US')
      : undefined,
    'certification.lte': filters.maxCertification,
    with_cast: filters.castIds?.join(','),
    with_crew: filters.crewIds?.join(','),
  };
}

/** Stable cache key for a filter set. */
export function discoverCacheKey(params: TmdbParams): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');
}
