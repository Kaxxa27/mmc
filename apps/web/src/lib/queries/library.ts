'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Query } from '@/lib/api/client';
import type {
  DefaultList,
  LibraryEntry,
  LibraryStats,
  MovieStatus,
  Paginated,
  ReviewView,
  WatchEventView,
} from '@/lib/api/types';
import { keys, MOVIE_STATE_KEYS } from './keys';
import { orNullOn404 } from './movies';
import { useApiMutation } from './use-api-mutation';

export type LibrarySort =
  | 'added_desc'
  | 'added_asc'
  | 'title_asc'
  | 'title_desc'
  | 'release_desc'
  | 'release_asc'
  | 'rating_desc'
  | 'rating_asc'
  | 'tmdb_rating_desc'
  | 'popularity_desc'
  | 'watched_desc'
  | 'runtime_asc'
  | 'runtime_desc';

export interface LibraryQuery {
  status?: MovieStatus[];
  favorite?: boolean;
  genreIds?: number[];
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  maxRating?: number;
  maxRuntime?: number;
  query?: string;
  sort?: LibrarySort;
  page?: number;
  pageSize?: number;
}

export function useLibrary(query: LibraryQuery) {
  return useQuery({
    queryKey: [...keys.library, 'list', query],
    queryFn: ({ signal }) => api.get<Paginated<LibraryEntry>>('/me/movies', query as Query, signal),
    placeholderData: keepPreviousData,
  });
}

/** The catalog entry for a movie, or `null` when it is not in the catalog. */
export function useLibraryEntry(tmdbId: number, enabled = true) {
  return useQuery({
    queryKey: [...keys.library, 'entry', tmdbId],
    queryFn: ({ signal }) =>
      orNullOn404(api.get<LibraryEntry>(`/me/movies/${tmdbId}`, undefined, signal)),
    enabled,
  });
}

export function useDefaultLists() {
  return useQuery({
    queryKey: [...keys.library, 'lists'],
    queryFn: async () => (await api.get<{ lists: DefaultList[] }>('/me/lists')).lists,
  });
}

export function useHistory(query: { page?: number; from?: string; to?: string }) {
  return useQuery({
    queryKey: [...keys.library, 'history', query],
    queryFn: ({ signal }) => api.get<Paginated<WatchEventView>>('/me/history', query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useStats() {
  return useQuery({
    queryKey: [...keys.library, 'stats'],
    queryFn: ({ signal }) => api.get<LibraryStats>('/me/stats', undefined, signal),
  });
}

export interface LibraryUpdate {
  status?: MovieStatus | null;
  isFavorite?: boolean;
  rating?: number | null;
  notes?: string | null;
  watchedOn?: string;
  logViewing?: boolean;
}

export function useUpdateLibraryEntry(
  success?: string | ((entry: LibraryEntry) => string | undefined),
) {
  return useApiMutation(
    ({ tmdbId, ...update }: LibraryUpdate & { tmdbId: number }) =>
      api.put<LibraryEntry>(`/me/movies/${tmdbId}`, update),
    { invalidate: MOVIE_STATE_KEYS, success },
  );
}

export function useRemoveLibraryEntry() {
  return useApiMutation(
    ({ tmdbId, includeHistory }: { tmdbId: number; includeHistory?: boolean }) =>
      api.delete(`/me/movies/${tmdbId}${includeHistory ? '?includeHistory=true' : ''}`),
    { invalidate: MOVIE_STATE_KEYS, success: 'Removed from your catalog' },
  );
}

export interface ViewingInput {
  watchedOn?: string;
  rating?: number | null;
  notes?: string | null;
  isRewatch?: boolean;
}

export function useLogViewing() {
  return useApiMutation(
    ({ tmdbId, rating, ...rest }: ViewingInput & { tmdbId: number }) =>
      api.post<WatchEventView>('/me/history', { tmdbId, ...rest, ...(rating ? { rating } : {}) }),
    { invalidate: MOVIE_STATE_KEYS, success: 'Viewing logged' },
  );
}

export function useUpdateViewing() {
  return useApiMutation(
    ({ id, ...update }: ViewingInput & { id: string }) =>
      api.patch<WatchEventView>(`/me/history/${id}`, update),
    { invalidate: MOVIE_STATE_KEYS, success: 'Viewing updated' },
  );
}

export function useDeleteViewing() {
  return useApiMutation((id: string) => api.delete(`/me/history/${id}`), {
    invalidate: MOVIE_STATE_KEYS,
    success: 'Viewing deleted',
  });
}

/** Random pick from the catalog (watchlist by default). */
export function pickRandomFromLibrary(filters: Omit<LibraryQuery, 'sort' | 'page' | 'pageSize'>) {
  return api.get<LibraryEntry>('/me/movies/random', filters as Query);
}

export function useMyReviews(page: number) {
  return useQuery({
    queryKey: [...keys.reviews, 'mine', page],
    queryFn: ({ signal }) =>
      api.get<Paginated<ReviewView>>('/me/reviews', { page, pageSize: 20 }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useMyReview(tmdbId: number, enabled = true) {
  return useQuery({
    queryKey: [...keys.reviews, 'mine', 'movie', tmdbId],
    queryFn: ({ signal }) =>
      orNullOn404(api.get<ReviewView>(`/me/reviews/${tmdbId}`, undefined, signal)),
    enabled,
  });
}

export interface ReviewInput {
  body: string;
  rating?: number | null;
  containsSpoilers?: boolean;
  isPublic?: boolean;
}

export function useSaveReview() {
  return useApiMutation(
    ({ tmdbId, ...input }: ReviewInput & { tmdbId: number }) =>
      api.put<ReviewView>(`/me/reviews/${tmdbId}`, input),
    { invalidate: [keys.reviews, ...MOVIE_STATE_KEYS], success: 'Review saved' },
  );
}

export function useDeleteReview() {
  return useApiMutation((tmdbId: number) => api.delete(`/me/reviews/${tmdbId}`), {
    invalidate: [keys.reviews],
    success: 'Review deleted',
  });
}
