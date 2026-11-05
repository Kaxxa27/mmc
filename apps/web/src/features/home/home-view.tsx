'use client';

import { CalendarDays, Compass, Dices, LogIn, Popcorn } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { notificationHref } from '@/components/notifications/notification-link';
import { MovieRow } from '@/components/movies/movie-row';
import { Poster } from '@/components/movies/poster';
import { RandomPickDialog } from '@/components/movies/random-pick-dialog';
import { Button } from '@/components/ui/button';
import { Badge, Card, ErrorState, Skeleton } from '@/components/ui/misc';
import { PendingInvitations } from '@/features/groups/pending-invitations';
import type { HomeMovieNight } from '@/lib/api/types';
import { MOVIE_NIGHT_STATUS_META } from '@/lib/constants';
import { entryToMovie } from '@/lib/movies';
import { useMe } from '@/lib/queries/core';
import { useHome } from '@/lib/queries/discovery';
import { pickRandomFromLibrary } from '@/lib/queries/library';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';

const LIST_KEYS = new Set(['trending', 'popular', 'top-rated', 'now-playing', 'upcoming']);

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function MovieNightCard({ night }: { night: HomeMovieNight }) {
  const status = MOVIE_NIGHT_STATUS_META[night.status];
  return (
    <Link
      href={`/movie-nights/${night.id}`}
      className="flex w-72 shrink-0 gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-muted/50"
    >
      {night.selectedMovie ? (
        <Poster
          src={night.selectedMovie.posterUrl}
          title={night.selectedMovie.title}
          className="w-14 shrink-0 rounded-lg"
        />
      ) : (
        <span className="flex h-21 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Popcorn className="size-6" aria-hidden />
        </span>
      )}
      <span className="min-w-0 py-0.5">
        <Badge className={status.badge}>{status.label}</Badge>
        <span className="mt-1.5 block truncate font-medium">{night.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {night.group.name}
          {night.scheduledAt ? ` · ${formatDateTime(night.scheduledAt)}` : ''}
        </span>
        {night.selectedMovie ? (
          <span className="mt-0.5 block truncate text-xs">🎬 {night.selectedMovie.title}</span>
        ) : null}
      </span>
    </Link>
  );
}

function GuestHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-rose-500 to-orange-400 px-6 py-10 text-white shadow-lg sm:px-10 sm:py-14">
      <div className="max-w-xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Every movie you love, in one place.
        </h1>
        <p className="mt-3 text-base text-white/85 sm:text-lg">
          Discover movies, keep a watchlist, rate what you watched, share collections with your
          family and plan movie nights together.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg" className="bg-white text-rose-600 hover:bg-white/90">
            <Link href="/sign-in">
              <LogIn aria-hidden />
              Get started
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/15">
            <Link href="/discover">
              <Compass aria-hidden />
              Browse movies
            </Link>
          </Button>
        </div>
      </div>
      <Popcorn
        className="absolute -bottom-6 -right-6 size-48 rotate-12 text-white/15"
        aria-hidden
      />
    </section>
  );
}

export function HomeView() {
  const { data: me } = useMe();
  const { data: home, isPending, error, refetch } = useHome();
  const [randomOpen, setRandomOpen] = useState(false);

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="flex flex-col gap-10">
      {home?.welcome ? (
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{greeting()},</p>
            <h1 className="text-3xl font-bold tracking-tight">{home.welcome.displayName}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRandomOpen(true)}>
              <Dices aria-hidden />
              Pick from my watchlist
            </Button>
            <Button asChild variant="outline">
              <Link href="/calendar">
                <CalendarDays aria-hidden />
                Calendar
              </Link>
            </Button>
          </div>
        </section>
      ) : isPending || me === undefined ? (
        <Skeleton className="h-16 w-72" />
      ) : (
        <GuestHero />
      )}

      {me ? <PendingInvitations /> : null}

      {home?.upcomingMovieNights && home.upcomingMovieNights.length > 0 ? (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
              Upcoming movie nights
            </h2>
            <Link href="/movie-nights" className="text-sm font-medium text-primary hover:underline">
              All movie nights
            </Link>
          </div>
          <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
            {home.upcomingMovieNights.map((night) => (
              <MovieNightCard key={night.id} night={night} />
            ))}
          </div>
        </section>
      ) : null}

      {home?.watchlist ? (
        <MovieRow
          title="Your watchlist"
          movies={home.watchlist.map(entryToMovie)}
          href="/watchlist"
          empty="Movies you mark as “Want to watch” show up here."
        />
      ) : null}

      {isPending ? (
        <>
          <MovieRow title="Trending this week" movies={undefined} loading />
          <MovieRow title="Popular movies" movies={undefined} loading />
        </>
      ) : (
        home?.sections.map((section) => (
          <MovieRow
            key={section.key + section.title}
            title={section.title}
            movies={section.movies}
            href={LIST_KEYS.has(section.key) ? `/discover?list=${section.key}` : undefined}
          />
        ))
      )}

      {home?.recentlyAdded && home.recentlyAdded.length > 0 ? (
        <MovieRow
          title="Recently added to your catalog"
          movies={home.recentlyAdded.map(entryToMovie)}
          href="/my-movies?sort=added_desc"
        />
      ) : null}

      {home?.groupActivity && home.groupActivity.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight sm:text-xl">Group activity</h2>
          <Card className="divide-y">
            {home.groupActivity.map((item, index) => (
              <Link
                key={`${item.createdAt}-${index}`}
                href={notificationHref(item)}
                className={cn(
                  'flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/50',
                )}
              >
                <span className="min-w-0 truncate">{item.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelative(item.createdAt)}
                </span>
              </Link>
            ))}
          </Card>
        </section>
      ) : null}

      {me ? (
        <RandomPickDialog
          open={randomOpen}
          onOpenChange={setRandomOpen}
          title="What should I watch?"
          description="A random movie from your watchlist."
          pick={async (filters) =>
            (await pickRandomFromLibrary({ status: ['want_to_watch'], ...filters })).movie
          }
        />
      ) : null}
    </div>
  );
}
