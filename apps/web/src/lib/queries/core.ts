'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api/client';
import type { AppConfigView, GenreRef, ProfileView } from '@/lib/api/types';
import { hasSessionHint } from '@/lib/session-hint';
import { keys } from './keys';
import { useApiMutation } from './use-api-mutation';

/** The signed-in user's profile, or `null` for guests. */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      if (!hasSessionHint()) return null;
      try {
        return await api.get<ProfileView>('/me');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    meta: { allowGuest: true },
  });
}

export function useAppConfig() {
  return useQuery({
    queryKey: keys.config,
    queryFn: () => api.get<AppConfigView>('/config'),
    staleTime: Infinity,
    meta: { allowGuest: true },
  });
}

export function useGenres() {
  return useQuery({
    queryKey: keys.genres,
    queryFn: async () => (await api.get<{ genres: GenreRef[] }>('/genres')).genres,
    staleTime: 60 * 60_000,
    meta: { allowGuest: true },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useApiMutation(
    (scope: 'local' | 'others' | 'global' = 'local') => api.post<void>('/auth/sign-out', { scope }),
    {
      onSuccess: (_data, scope) => {
        if (scope === 'others') return;
        queryClient.clear();
        router.replace('/');
        router.refresh();
      },
    },
  );
}
