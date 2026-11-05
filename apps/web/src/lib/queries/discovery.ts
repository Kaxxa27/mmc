'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { CalendarView, HomeView, RecommendationSection } from '@/lib/api/types';
import { keys } from './keys';

export function useHome() {
  return useQuery({
    queryKey: keys.home,
    queryFn: ({ signal }) => api.get<HomeView>('/home', undefined, signal),
    meta: { allowGuest: true },
  });
}

export function useRecommendations(enabled = true) {
  return useQuery({
    queryKey: keys.recommendations,
    queryFn: async ({ signal }) =>
      (
        await api.get<{ sections: RecommendationSection[] }>(
          '/me/recommendations',
          undefined,
          signal,
        )
      ).sections,
    enabled,
  });
}

export function useCalendar(range: { from: string; to: string }, groupId?: string) {
  const path = groupId ? `/groups/${groupId}/calendar` : '/me/calendar';
  return useQuery({
    queryKey: [...keys.calendar, groupId ?? 'me', range.from, range.to],
    queryFn: ({ signal }) => api.get<CalendarView>(path, range, signal),
    placeholderData: keepPreviousData,
  });
}
