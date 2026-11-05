'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  ActiveSession,
  DemoWorld,
  OtpRequestResult,
  ProfileView,
  SessionInfo,
} from '@/lib/api/types';
import { keys } from './keys';
import { useApiMutation } from './use-api-mutation';

export interface ProfileInput {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  language?: string;
  region?: string;
  favoriteGenreIds?: number[];
}

/** Language and region change movie data everywhere, so refetch all queries after saving. */
function useProfileSaved() {
  const queryClient = useQueryClient();
  return (profile: ProfileView, previous?: ProfileView | null) => {
    queryClient.setQueryData(keys.me, profile);
    if (!previous || previous.language !== profile.language || previous.region !== profile.region) {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== keys.me[0],
      });
    }
  };
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const saved = useProfileSaved();
  return useApiMutation((input: ProfileInput) => api.patch<ProfileView>('/me', input), {
    success: 'Profile saved',
    onSuccess: (profile) => saved(profile, queryClient.getQueryData<ProfileView | null>(keys.me)),
  });
}

export function useCompleteOnboarding() {
  const saved = useProfileSaved();
  return useApiMutation(
    (input: ProfileInput & { firstName: string }) => api.post<ProfileView>('/me/onboarding', input),
    { onSuccess: (profile) => saved(profile, null) },
  );
}

export function checkUsername(username: string, signal?: AbortSignal) {
  return api.get<{ username: string; available: boolean }>(
    '/me/username-availability',
    { username },
    signal,
  );
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.upload<ProfileView>('/me/avatar', form);
    },
    {
      success: 'Profile picture updated',
      onSuccess: (profile) => {
        queryClient.setQueryData(keys.me, profile);
      },
    },
  );
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useApiMutation(() => api.delete<ProfileView>('/me/avatar'), {
    success: 'Profile picture removed',
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile);
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: keys.sessions,
    queryFn: ({ signal }) => api.get<ActiveSession[]>('/auth/sessions', undefined, signal),
  });
}

export function useRevokeSession() {
  return useApiMutation((sessionId: string) => api.delete(`/auth/sessions/${sessionId}`), {
    invalidate: [keys.sessions],
    success: 'Device signed out',
  });
}

export function requestOtp(email: string) {
  return api.post<OtpRequestResult>('/auth/otp', { email });
}

export function verifyOtp(email: string, code: string) {
  return api.post<SessionInfo>('/auth/otp/verify', { email, code });
}

export function verifyMagicLink(tokenHash: string) {
  return api.post<SessionInfo>('/auth/magic-link/verify', { tokenHash });
}

export function devSignIn(email: string) {
  return api.post<SessionInfo>('/dev/sign-in', { email });
}

/** Shared demo accounts (enabled with DEMO_ACCOUNTS_ENABLED on the API). */
export function demoSignIn(member: 'anna' | 'ben' | 'chloe') {
  return api.post<SessionInfo>('/demo/sign-in', { member });
}

export function devDemo() {
  return api.post<DemoWorld>('/dev/demo', {});
}
