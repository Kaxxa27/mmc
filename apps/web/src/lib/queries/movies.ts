'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, ApiError, type Query } from '@/lib/api/client';
import type {
  CombinedSearchResult,
  MovieDetails,
  MovieListResult,
  Paginated,
  PersonDetails,
  PublicReviewView,
} from '@/lib/api/types';
import { keys } from './keys';

export type MovieListKind = 'popular' | 'trending' | 'top-rated' | 'upcoming' | 'now-playing';

export function useMovieList(list: MovieListKind, page = 1, window?: 'day' | 'week') {
  return useQuery({
    queryKey: [...keys.movies, 'list', list, page, window],
    queryFn: ({ signal }) =>
      api.get<MovieListResult>(`/movies/lists/${list}`, { page, window }, signal),
    placeholderData: keepPreviousData,
    meta: { allowGuest: true },
  });
}

export interface DiscoverFilters {
  genreIds?: number[];
  genreMatch?: 'any' | 'all';
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  maxRuntime?: number;
  maxCertification?: string;
  originalLanguage?: string;
  releaseState?: 'released' | 'upcoming';
  sort?: 'popularity' | 'rating' | 'newest' | 'oldest' | 'title';
  page?: number;
}

export function useDiscover(filters: DiscoverFilters) {
  return useQuery({
    queryKey: [...keys.movies, 'discover', filters],
    queryFn: ({ signal }) => api.get<MovieListResult>('/movies/discover', filters as Query, signal),
    placeholderData: keepPreviousData,
    meta: { allowGuest: true },
  });
}

export function useSearch(query: string, page = 1) {
  return useQuery({
    queryKey: [...keys.movies, 'search', query, page],
    queryFn: ({ signal }) => api.get<CombinedSearchResult>('/search', { query, page }, signal),
    enabled: query.trim().length > 0,
    placeholderData: keepPreviousData,
    meta: { allowGuest: true },
  });
}

/** Movie search for pickers (movies only). */
export function useMovieSearch(query: string) {
  return useQuery({
    queryKey: [...keys.movies, 'picker', query],
    queryFn: ({ signal }) => api.get<MovieListResult>('/movies/search', { query }, signal),
    enabled: query.trim().length > 1,
    placeholderData: keepPreviousData,
  });
}

export function useMovie(tmdbId: number) {
  return useQuery({
    queryKey: [...keys.movie, tmdbId],
    queryFn: ({ signal }) => api.get<MovieDetails>(`/movies/${tmdbId}`, undefined, signal),
    meta: { allowGuest: true },
  });
}

export function usePerson(personId: number) {
  return useQuery({
    queryKey: [...keys.people, personId],
    queryFn: ({ signal }) => api.get<PersonDetails>(`/people/${personId}`, undefined, signal),
    meta: { allowGuest: true },
  });
}

export function usePublicReviews(tmdbId: number, page = 1) {
  return useQuery({
    queryKey: [...keys.reviews, 'public', tmdbId, page],
    queryFn: ({ signal }) =>
      api.get<Paginated<PublicReviewView>>(
        `/movies/${tmdbId}/reviews`,
        { page, pageSize: 10 },
        signal,
      ),
    placeholderData: keepPreviousData,
    meta: { allowGuest: true },
  });
}

/** `null` when the API answers 404 with one of the given codes (e.g. "not in your catalog"). */
export async function orNullOn404<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
