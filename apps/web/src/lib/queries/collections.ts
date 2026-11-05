'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api/client';
import type {
  CollectionDetails,
  CollectionShareView,
  CollectionSummary,
  CollectionVisibility,
  Paginated,
} from '@/lib/api/types';
import { hasSessionHint } from '@/lib/session-hint';
import { keys } from './keys';
import { useApiMutation } from './use-api-mutation';

export type CollectionScope = 'mine' | 'shared' | 'group';

export function useCollections(
  scope: CollectionScope,
  options: { groupId?: string; page?: number; pageSize?: number } = {},
) {
  const { groupId, page = 1, pageSize = 24 } = options;
  return useQuery({
    queryKey: [...keys.collections, 'list', scope, groupId, page, pageSize],
    queryFn: ({ signal }) =>
      api.get<Paginated<CollectionSummary>>(
        '/collections',
        { scope, groupId, page, pageSize },
        signal,
      ),
    enabled: scope !== 'group' || Boolean(groupId),
    placeholderData: keepPreviousData,
  });
}

/**
 * A collection by id. Guests (and people without access) fall back to the public endpoint,
 * so public collections open for anyone with the link.
 */
export function useCollection(collectionId: string) {
  return useQuery({
    queryKey: [...keys.collections, 'detail', collectionId],
    queryFn: async ({ signal }) => {
      if (!hasSessionHint()) {
        return api.get<CollectionDetails>(`/public/collections/${collectionId}`, undefined, signal);
      }
      try {
        return await api.get<CollectionDetails>(`/collections/${collectionId}`, undefined, signal);
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 404 || error.status === 403)
        ) {
          return api.get<CollectionDetails>(
            `/public/collections/${collectionId}`,
            undefined,
            signal,
          );
        }
        throw error;
      }
    },
    meta: { allowGuest: true },
  });
}

export interface CollectionInput {
  name?: string;
  description?: string | null;
  coverImageUrl?: string | null;
  visibility?: CollectionVisibility;
  groupId?: string;
}

export function useCreateCollection() {
  return useApiMutation(
    (input: CollectionInput & { name: string }) =>
      api.post<CollectionDetails>('/collections', input),
    {
      invalidate: [keys.collections],
      success: (collection) => `Created “${collection.name}”`,
    },
  );
}

export function useUpdateCollection(collectionId: string) {
  return useApiMutation(
    (input: Omit<CollectionInput, 'groupId'>) =>
      api.patch<CollectionDetails>(`/collections/${collectionId}`, input),
    { invalidate: [keys.collections], success: 'Collection updated' },
  );
}

export function useDeleteCollection() {
  return useApiMutation((collectionId: string) => api.delete(`/collections/${collectionId}`), {
    invalidate: [keys.collections],
    success: 'Collection deleted',
  });
}

export function useUploadCollectionCover(collectionId: string) {
  return useApiMutation(
    (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.upload<CollectionDetails>(`/collections/${collectionId}/cover`, form);
    },
    { invalidate: [keys.collections], success: 'Cover updated' },
  );
}

export function useAddToCollection() {
  return useApiMutation(
    ({
      collectionId,
      tmdbId,
      note,
    }: {
      collectionId: string;
      tmdbId: number;
      note?: string | null;
    }) => api.post<CollectionDetails>(`/collections/${collectionId}/items`, { tmdbId, note }),
    { invalidate: [keys.collections], success: (collection) => `Added to “${collection.name}”` },
  );
}

export function useRemoveFromCollection(collectionId: string) {
  return useApiMutation(
    (tmdbId: number) => api.delete(`/collections/${collectionId}/items/${tmdbId}`),
    {
      invalidate: [keys.collections],
      success: 'Removed from the collection',
    },
  );
}

export function useReorderCollection(collectionId: string) {
  return useApiMutation(
    (tmdbIds: number[]) =>
      api.put<CollectionDetails>(`/collections/${collectionId}/items/order`, { tmdbIds }),
    { invalidate: [keys.collections] },
  );
}

export function useCollectionShares(collectionId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...keys.collections, 'shares', collectionId],
    queryFn: ({ signal }) =>
      api.get<CollectionShareView[]>(`/collections/${collectionId}/shares`, undefined, signal),
    enabled,
  });
}

export function useShareCollection(collectionId: string) {
  return useApiMutation(
    (target: { groupId: string } | { username: string }) =>
      api.post<CollectionShareView[]>(`/collections/${collectionId}/shares`, target),
    { invalidate: [keys.collections], success: 'Shared' },
  );
}

export function useUnshareCollection(collectionId: string) {
  return useApiMutation(
    (shareId: string) => api.delete(`/collections/${collectionId}/shares/${shareId}`),
    {
      invalidate: [keys.collections],
      success: 'Sharing removed',
    },
  );
}
