'use client';

import { Ellipsis, Film, FlaskConical, LogIn, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, Suspense, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/misc';
import { useAppConfig, useMe } from '@/lib/queries/core';
import { HeaderSearch } from './header-search';
import { BottomNavLinks, MORE_ITEMS, SidebarNav } from './nav-links';
import { NotificationBell } from './notification-bell';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

/*
 * Everything that reads queries sits in its own <Suspense>: with Cache Components, Client
 * Components are prerendered too, and TanStack Query reads the clock while creating query
 * state — outside a boundary that fails the build. The frame itself stays in the static shell.
 */

function currentPath() {
  return `${window.location.pathname}${window.location.search}`;
}

function useGoToSignIn() {
  const router = useRouter();
  return () => router.push(`/sign-in?next=${encodeURIComponent(currentPath())}`);
}

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Film className="size-5" aria-hidden />
      </span>
      <span className="hidden text-base md:inline">My Movie Catalog</span>
    </Link>
  );
}

function HeaderAccount() {
  const { data: me, isPending } = useMe();
  const goToSignIn = useGoToSignIn();
  if (me) {
    return (
      <>
        <NotificationBell />
        <div className="ml-1">
          <UserMenu me={me} />
        </div>
      </>
    );
  }
  if (isPending) return <Skeleton className="ml-1 size-8 rounded-full" />;
  return (
    <Button size="sm" className="ml-1" onClick={goToSignIn}>
      <LogIn aria-hidden />
      Sign in
    </Button>
  );
}

/** New accounts finish onboarding (name, favorite genres, preferences) first. */
function OnboardingGuard() {
  const { data: me } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me && !me.onboardingCompleted) {
      router.replace(`/onboarding?next=${encodeURIComponent(currentPath())}`);
    }
  }, [me, router]);
  return null;
}

function GuestCard() {
  const { data: me, isPending } = useMe();
  const goToSignIn = useGoToSignIn();
  if (me || isPending) return null;
  return (
    <div className="mt-6 rounded-xl bg-muted p-4 text-sm">
      <p className="font-semibold">Build your catalog</p>
      <p className="mt-1 text-muted-foreground">
        Sign in to save movies, rate them, share collections and plan movie nights.
      </p>
      <Button size="sm" className="mt-3 w-full" onClick={goToSignIn}>
        Sign in
      </Button>
    </div>
  );
}

function MovieDataNote() {
  const { data: config } = useAppConfig();
  if (!config || config.movieData.mode === 'live') return null;
  const mock = config.movieData.mode === 'mock';
  return (
    <div className="mt-6 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <FlaskConical className="size-3.5" aria-hidden />
        {mock ? 'Demo movie data' : 'Movie data offline'}
      </p>
      <p className="mt-1 leading-relaxed">
        {mock
          ? 'No TMDB key is configured, so the API serves a built-in set of mock movies.'
          : 'TMDB is not configured. Movies already saved locally still work.'}
      </p>
    </div>
  );
}

function Attribution() {
  const { data: config } = useAppConfig();
  return (
    <p>
      {config?.movieData.attribution ?? 'Movie data from TMDB.'}{' '}
      {config ? (
        <a
          href={config.movieData.attributionUrl}
          className="underline underline-offset-2 hover:text-foreground"
          target="_blank"
          rel="noreferrer"
        >
          themoviedb.org
        </a>
      ) : null}
    </p>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Suspense fallback={null}>
        <OnboardingGuard />
      </Suspense>
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <Logo />
          <HeaderSearch className="mx-auto hidden max-w-xl sm:block" />
          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            <Button asChild variant="ghost" size="icon" className="sm:hidden" aria-label="Search">
              <Link href="/search">
                <Search aria-hidden />
              </Link>
            </Button>
            <ThemeToggle />
            <Suspense fallback={<Skeleton className="ml-1 size-8 rounded-full" />}>
              <HeaderAccount />
            </Suspense>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 overflow-y-auto border-r px-3 py-6 lg:block">
          <SidebarNav />
          <Suspense fallback={null}>
            <GuestCard />
            <MovieDataNote />
          </Suspense>
        </aside>

        <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12">
          {children}
          <footer className="mt-12 border-t pt-6 text-xs text-muted-foreground">
            <Suspense fallback={<p>Movie data from TMDB.</p>}>
              <Attribution />
            </Suspense>
          </footer>
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label="Primary"
      >
        <BottomNavLinks />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground">
            <Ellipsis className="size-5" aria-hidden />
            More
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" className="mb-2 w-56">
            {MORE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>
                    <Icon aria-hidden />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
  );
}
