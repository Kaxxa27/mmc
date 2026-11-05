'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Query } from '@/lib/api/client';
import type {
  AcceptInvitationResult,
  CommentView,
  CreatedLinkInvitation,
  GroupDetails,
  GroupKind,
  GroupMovieDetails,
  GroupMovieStatus,
  GroupMovieView,
  GroupSummary,
  InvitationPreview,
  InvitationView,
  MemberView,
  MyInvitationView,
  Paginated,
} from '@/lib/api/types';
import { keys } from './keys';
import { useApiMutation } from './use-api-mutation';

export function useGroups(includeArchived = false) {
  return useQuery({
    queryKey: [...keys.groups, 'list', includeArchived],
    queryFn: ({ signal }) => api.get<GroupSummary[]>('/groups', { includeArchived }, signal),
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: [...keys.groups, 'detail', groupId],
    queryFn: ({ signal }) => api.get<GroupDetails>(`/groups/${groupId}`, undefined, signal),
  });
}

export interface GroupInput {
  name?: string;
  description?: string | null;
  kind?: GroupKind;
}

export function useCreateGroup() {
  return useApiMutation(
    (input: GroupInput & { name: string }) => api.post<GroupDetails>('/groups', input),
    {
      invalidate: [keys.groups],
      success: (group) => `Created “${group.name}”`,
    },
  );
}

export function useUpdateGroup(groupId: string) {
  return useApiMutation(
    (input: GroupInput) => api.patch<GroupDetails>(`/groups/${groupId}`, input),
    {
      invalidate: [keys.groups],
      success: 'Group updated',
    },
  );
}

export function useUploadGroupAvatar(groupId: string) {
  return useApiMutation(
    (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.upload<GroupDetails>(`/groups/${groupId}/avatar`, form);
    },
    { invalidate: [keys.groups], success: 'Group picture updated' },
  );
}

export function useArchiveGroup(groupId: string) {
  return useApiMutation(
    (archive: boolean) =>
      api.post<GroupDetails>(`/groups/${groupId}/${archive ? 'archive' : 'restore'}`),
    {
      invalidate: [keys.groups],
      success: (_group, archive) => (archive ? 'Group archived' : 'Group restored'),
    },
  );
}

export function useDeleteGroup() {
  return useApiMutation((groupId: string) => api.delete(`/groups/${groupId}`), {
    invalidate: [keys.groups, keys.collections, keys.movieNights],
    success: 'Group deleted',
  });
}

export function useChangeMemberRole(groupId: string) {
  return useApiMutation(
    ({ userId, role }: { userId: string; role: 'admin' | 'member' }) =>
      api.patch<MemberView[]>(`/groups/${groupId}/members/${userId}`, { role }),
    { invalidate: [keys.groups], success: 'Role updated' },
  );
}

export function useRemoveMember(groupId: string) {
  return useApiMutation((userId: string) => api.delete(`/groups/${groupId}/members/${userId}`), {
    invalidate: [keys.groups],
    success: 'Member removed',
  });
}

export function useLeaveGroup() {
  return useApiMutation((groupId: string) => api.post<void>(`/groups/${groupId}/leave`), {
    invalidate: [keys.groups, keys.collections, keys.movieNights],
    success: 'You left the group',
  });
}

export function useTransferOwnership(groupId: string) {
  return useApiMutation(
    (userId: string) => api.post<GroupDetails>(`/groups/${groupId}/transfer-ownership`, { userId }),
    { invalidate: [keys.groups], success: 'Ownership transferred' },
  );
}

// ---- Group catalog ----

export interface GroupMovieQuery {
  status?: GroupMovieStatus;
  genreIds?: number[];
  maxRuntime?: number;
  query?: string;
  sort?:
    | 'added_desc'
    | 'added_asc'
    | 'title_asc'
    | 'release_desc'
    | 'group_rating_desc'
    | 'tmdb_rating_desc';
  page?: number;
  pageSize?: number;
}

export function useGroupMovies(groupId: string, query: GroupMovieQuery) {
  return useQuery({
    queryKey: [...keys.groups, 'movies', groupId, query],
    queryFn: ({ signal }) =>
      api.get<Paginated<GroupMovieView>>(`/groups/${groupId}/movies`, query as Query, signal),
    placeholderData: keepPreviousData,
  });
}

export function pickRandomGroupMovie(
  groupId: string,
  filters: Omit<GroupMovieQuery, 'sort' | 'page' | 'pageSize'>,
) {
  return api.get<GroupMovieView>(`/groups/${groupId}/movies/random`, filters as Query);
}

export function useGroupMovie(groupId: string, tmdbId: number) {
  return useQuery({
    queryKey: [...keys.groups, 'movie', groupId, tmdbId],
    queryFn: ({ signal }) =>
      api.get<GroupMovieDetails>(`/groups/${groupId}/movies/${tmdbId}`, undefined, signal),
  });
}

export function useAddGroupMovie() {
  return useApiMutation(
    ({ groupId, tmdbId, note }: { groupId: string; tmdbId: number; note?: string | null }) =>
      api.post<GroupMovieDetails>(`/groups/${groupId}/movies`, { tmdbId, note }),
    { invalidate: [keys.groups, keys.home], success: 'Added to the group catalog' },
  );
}

export function useUpdateGroupMovie(groupId: string, tmdbId: number) {
  return useApiMutation(
    (update: { status?: GroupMovieStatus; watchedOn?: string | null; note?: string | null }) =>
      api.patch<GroupMovieDetails>(`/groups/${groupId}/movies/${tmdbId}`, update),
    { invalidate: [keys.groups, keys.calendar], success: 'Updated' },
  );
}

export function useRemoveGroupMovie(groupId: string) {
  return useApiMutation((tmdbId: number) => api.delete(`/groups/${groupId}/movies/${tmdbId}`), {
    invalidate: [keys.groups],
    success: 'Removed from the group catalog',
  });
}

export function useRateGroupMovie(groupId: string, tmdbId: number) {
  return useApiMutation(
    (input: { rating: number; review?: string | null; containsSpoilers?: boolean }) =>
      api.put<GroupMovieDetails>(`/groups/${groupId}/movies/${tmdbId}/rating`, input),
    { invalidate: [keys.groups], success: 'Rating saved' },
  );
}

export function useRemoveGroupRating(groupId: string, tmdbId: number) {
  return useApiMutation(() => api.delete(`/groups/${groupId}/movies/${tmdbId}/rating`), {
    invalidate: [keys.groups],
    success: 'Rating removed',
  });
}

// ---- Comments (group movies and movie nights share the group's comment routes) ----

export type CommentTarget =
  | { kind: 'group-movie'; groupId: string; tmdbId: number }
  | { kind: 'movie-night'; groupId: string; movieNightId: string };

function commentsPath(target: CommentTarget) {
  return target.kind === 'group-movie'
    ? `/groups/${target.groupId}/movies/${target.tmdbId}/comments`
    : `/movie-nights/${target.movieNightId}/comments`;
}

function commentsKey(target: CommentTarget) {
  return target.kind === 'group-movie'
    ? [...keys.groups, 'comments', target.groupId, target.tmdbId]
    : [...keys.movieNights, 'comments', target.movieNightId];
}

export function useComments(target: CommentTarget, page = 1) {
  return useQuery({
    queryKey: [...commentsKey(target), page],
    queryFn: ({ signal }) =>
      api.get<Paginated<CommentView>>(commentsPath(target), { page, pageSize: 50 }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useAddComment(target: CommentTarget) {
  return useApiMutation((body: string) => api.post<CommentView>(commentsPath(target), { body }), {
    invalidate: [commentsKey(target), keys.groups],
  });
}

export function useEditComment(target: CommentTarget) {
  return useApiMutation(
    ({ id, body }: { id: string; body: string }) =>
      api.patch<CommentView>(`/groups/${target.groupId}/comments/${id}`, { body }),
    { invalidate: [commentsKey(target)], success: 'Comment updated' },
  );
}

export function useDeleteComment(target: CommentTarget) {
  return useApiMutation((id: string) => api.delete(`/groups/${target.groupId}/comments/${id}`), {
    invalidate: [commentsKey(target), keys.groups],
    success: 'Comment deleted',
  });
}

// ---- Invitations ----

export function useGroupInvitations(groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...keys.invitations, 'group', groupId],
    queryFn: ({ signal }) =>
      api.get<InvitationView[]>(`/groups/${groupId}/invitations`, undefined, signal),
    enabled,
  });
}

export function useInviteByEmail(groupId: string) {
  return useApiMutation(
    (input: { email: string; role?: 'admin' | 'member'; expiresInDays?: number }) =>
      api.post<InvitationView>(`/groups/${groupId}/invitations`, input),
    {
      invalidate: [keys.invitations],
      success: (invitation) => `Invitation sent to ${invitation.email}`,
    },
  );
}

export function useCreateInvitationLink(groupId: string) {
  return useApiMutation(
    (input: { role?: 'admin' | 'member'; expiresInDays?: number; maxUses?: number }) =>
      api.post<CreatedLinkInvitation>(`/groups/${groupId}/invitation-links`, input),
    { invalidate: [keys.invitations] },
  );
}

export function useRevokeInvitation(groupId: string) {
  return useApiMutation(
    (invitationId: string) => api.delete(`/groups/${groupId}/invitations/${invitationId}`),
    {
      invalidate: [keys.invitations],
      success: 'Invitation revoked',
    },
  );
}

export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: [...keys.invitations, 'preview', token],
    queryFn: ({ signal }) =>
      api.get<InvitationPreview>(`/invitations/${encodeURIComponent(token)}`, undefined, signal),
    meta: { allowGuest: true },
  });
}

export function useAcceptInvitationLink() {
  return useApiMutation(
    (token: string) =>
      api.post<AcceptInvitationResult>(`/invitations/${encodeURIComponent(token)}/accept`),
    { invalidate: [keys.groups, keys.invitations, keys.notifications] },
  );
}

export function useMyInvitations(enabled = true) {
  return useQuery({
    queryKey: [...keys.invitations, 'mine'],
    queryFn: ({ signal }) => api.get<MyInvitationView[]>('/me/invitations', undefined, signal),
    enabled,
  });
}

export function useRespondToInvitation() {
  return useApiMutation(
    async ({
      invitationId,
      accept,
    }: {
      invitationId: string;
      accept: boolean;
    }): Promise<AcceptInvitationResult | null> => {
      if (accept) return api.post<AcceptInvitationResult>(`/me/invitations/${invitationId}/accept`);
      await api.post<void>(`/me/invitations/${invitationId}/decline`);
      return null;
    },
    {
      invalidate: [keys.groups, keys.invitations, keys.notifications],
      success: (_result, { accept }) => (accept ? 'Welcome to the group!' : 'Invitation declined'),
    },
  );
}
