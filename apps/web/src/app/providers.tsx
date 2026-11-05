'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { ThemeProvider, useTheme } from '@/lib/theme';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { allowGuest?: boolean };
  }
}

/** A protected request failed with 401: the session ended, so go to sign-in and come back. */
function redirectToSignIn(error: unknown, allowGuest?: boolean) {
  if (allowGuest || !(error instanceof ApiError) || error.status !== 401) return;
  if (typeof window === 'undefined' || window.location.pathname.startsWith('/sign-in')) return;
  const next = `${window.location.pathname}${window.location.search}`;
  // A full page load (not router.push) drops every cached query from the ended session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional hard navigation
  window.location.assign(`/sign-in?next=${encodeURIComponent(next)}`);
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          failureCount < 2 &&
          !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => redirectToSignIn(error, query.meta?.allowGuest),
    }),
    mutationCache: new MutationCache({ onError: (error) => redirectToSignIn(error) }),
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // Keep server renders isolated and reuse one client in the browser.
  if (typeof window === 'undefined') return createQueryClient();
  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="top-center" richColors closeButton />;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={getQueryClient()}>
        {children}
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
