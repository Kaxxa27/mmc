'use client';

import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  GroupSummary,
  MovieNightCriteria,
  MovieNightDetails,
  MovieNightStatus,
  MovieNightSummary,
  Paginated,
  SuggestionView,
  WatchEventView,
} from '@/lib/api/types';
import { keys } from './keys';
import { useApiMutation } from './use-api-mutation';

export type MovieNightWhen = 'upcoming' | 'past' | 'all';

export function useGroupMovieNights(
  groupId: string,
  query: { when?: MovieNightWhen; status?: MovieNightStatus; page?: number } = {},
) {
  return useQuery({
    queryKey: [...keys.movieNights, 'group', groupId, query],
    queryFn: ({ signal }) =>
      api.get<Paginated<MovieNightSummary>>(
        `/groups/${groupId}/movie-nights`,
        { pageSize: 50, ...query },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

/** Movie nights from every active group (the API lists them per group). */
export function useAllMovieNights(groups: GroupSummary[] | undefined, when: MovieNightWhen) {
  const active = (groups ?? []).filter((group) => !group.archived);
  return useQueries({
    queries: active.map((group) => ({
      queryKey: [...keys.movieNights, 'group', group.id, { when }],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.get<Paginated<MovieNightSummary>>(
          `/groups/${group.id}/movie-nights`,
          { when, pageSize: 50 },
          signal,
        ),
    })),
    combine: (results) => {
      const items = results.flatMap((result) => result.data?.items ?? []);
      const ascending = when === 'upcoming';
      items.sort((a, b) => {
        const left = a.scheduledAt ?? a.createdAt;
        const right = b.scheduledAt ?? b.createdAt;
        return ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
      return {
        items,
        isPending: results.some((result) => result.isPending),
        error: results.find((result) => result.error)?.error ?? null,
        refetch: () => results.forEach((result) => void result.refetch()),
      };
    },
  });
}

export function useMovieNight(movieNightId: string) {
  return useQuery({
    queryKey: [...keys.movieNights, 'detail', movieNightId],
    queryFn: ({ signal }) =>
      api.get<MovieNightDetails>(`/movie-nights/${movieNightId}`, undefined, signal),
    // Votes from other participants arrive without a reload.
    refetchInterval: (query) => (query.state.data?.status === 'voting' ? 15_000 : false),
  });
}

export function useSuggestions(movieNightId: string, enabled: boolean, limit = 12) {
  return useQuery({
    queryKey: [...keys.movieNights, 'suggestions', movieNightId, limit],
    queryFn: ({ signal }) =>
      api.get<SuggestionView[]>(`/movie-nights/${movieNightId}/suggestions`, { limit }, signal),
    enabled,
  });
}

export interface MovieNightInput {
  title?: string;
  description?: string | null;
  scheduledAt?: string | null;
  participantIds?: string[];
  criteria?: MovieNightCriteria;
}

export function useCreateMovieNight(groupId: string) {
  return useApiMutation(
    (input: MovieNightInput & { title: string }) =>
      api.post<MovieNightDetails>(`/groups/${groupId}/movie-nights`, input),
    { invalidate: [keys.movieNights, keys.calendar, keys.home], success: 'Movie night created' },
  );
}

export function useUpdateMovieNight(movieNightId: string) {
  return useApiMutation(
    (input: MovieNightInput) =>
      api.patch<MovieNightDetails>(`/movie-nights/${movieNightId}`, input),
    {
      invalidate: [keys.movieNights, keys.calendar, keys.home],
      success: 'Movie night updated',
    },
  );
}

export function useDeleteMovieNight() {
  return useApiMutation((movieNightId: string) => api.delete(`/movie-nights/${movieNightId}`), {
    invalidate: [keys.movieNights, keys.calendar, keys.home],
    success: 'Movie night deleted',
  });
}

const invalidateNight = [keys.movieNights, keys.calendar, keys.home];

/** Every state transition and candidate change returns the updated movie night. */
export function useMovieNightAction<TVars = void>(
  movieNightId: string,
  request: (base: string, vars: TVars) => Promise<MovieNightDetails>,
  success?: string,
) {
  return useApiMutation((vars: TVars) => request(`/movie-nights/${movieNightId}`, vars), {
    invalidate: invalidateNight,
    success,
  });
}

export function useLogMovieNightViewing(movieNightId: string) {
  return useApiMutation(
    (input: { rating?: number; watchedOn?: string }) =>
      api.post<WatchEventView>(`/movie-nights/${movieNightId}/log-viewing`, input),
    {
      invalidate: [...invalidateNight, keys.library, keys.movie, keys.groups],
      success: 'Added to your history',
    },
  );
}
