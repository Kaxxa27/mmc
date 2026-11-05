'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { SessionInfo } from '@/lib/api/types';
import { safeNext } from '@/lib/utils';

/** After any sign-in: drop guest data, then onboarding (new accounts) or the page the user came from. */
export function useFinishSignIn(next: string | null) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return (session: Pick<SessionInfo, 'needsOnboarding'>, target?: string) => {
    queryClient.clear();
    const destination = target ?? safeNext(next);
    if (session.needsOnboarding) {
      router.replace(`/onboarding?next=${encodeURIComponent(destination)}`);
    } else {
      router.replace(destination);
    }
    router.refresh();
  };
}
