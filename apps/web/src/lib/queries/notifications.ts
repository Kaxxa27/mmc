'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { NotificationList, NotificationPreference } from '@/lib/api/types';
import { keys } from './keys';
import { useApiMutation } from './use-api-mutation';

export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: [...keys.notifications, 'unread-count'],
    queryFn: async ({ signal }) =>
      (await api.get<{ unreadCount: number }>('/me/notifications/unread-count', undefined, signal))
        .unreadCount,
    enabled,
    refetchInterval: 60_000,
    meta: { allowGuest: true },
  });
}

export function useNotifications(query: {
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: [...keys.notifications, 'list', query],
    queryFn: ({ signal }) => api.get<NotificationList>('/me/notifications', query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useMarkNotificationRead() {
  return useApiMutation((id: string) => api.post<void>(`/me/notifications/${id}/read`), {
    invalidate: [keys.notifications],
    toastError: false,
  });
}

export function useMarkAllNotificationsRead() {
  return useApiMutation(() => api.post<{ updated: number }>('/me/notifications/read-all'), {
    invalidate: [keys.notifications],
    success: 'All caught up',
  });
}

export function useDeleteNotification() {
  return useApiMutation((id: string) => api.delete(`/me/notifications/${id}`), {
    invalidate: [keys.notifications],
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: [...keys.notifications, 'preferences'],
    queryFn: async ({ signal }) =>
      (
        await api.get<{ preferences: NotificationPreference[] }>(
          '/me/notification-preferences',
          undefined,
          signal,
        )
      ).preferences,
  });
}

export function useUpdateNotificationPreferences() {
  return useApiMutation(
    (preferences: NotificationPreference[]) =>
      api.put<{ preferences: NotificationPreference[] }>('/me/notification-preferences', {
        preferences,
      }),
    { invalidate: [keys.notifications], success: 'Notification settings saved' },
  );
}
