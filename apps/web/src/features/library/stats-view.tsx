'use client';

import { ChartColumn } from 'lucide-react';
import Link from 'next/link';
import {
  ColumnChart,
  type ColumnDatum,
  RankedBars,
  SegmentedBar,
  StatTile,
} from '@/components/charts/charts';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc';
import type { LibraryStats } from '@/lib/api/types';
import { useStats } from '@/lib/queries/library';
import { formatDate, plural } from '@/lib/utils';

function monthName(month: string, style: 'short' | 'long') {
  return formatDate(
    `${month}-15`,
    style === 'short' ? { month: 'short' } : { month: 'long', year: 'numeric' },
  );
}

/** The API only returns months with viewings; the chart shows all of the last 12. */
function lastTwelveMonths(data: LibraryStats['viewingsByMonth']): ColumnDatum[] {
  const counts = new Map(data.map((row) => [row.month, row.count]));
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const short = monthName(key, 'short');
    return {
      key,
      label:
        date.getMonth() === 0 || index === 0
          ? `${short} ’${String(date.getFullYear()).slice(2)}`
          : short,
      fullLabel: monthName(key, 'long'),
      value: counts.get(key) ?? 0,
    };
  });
}

function watchTime(minutes: number) {
  const hours = minutes / 60;
  if (hours < 10) return `${Math.round(hours * 10) / 10} h`;
  return `${Math.round(hours).toLocaleString('en-US')} h`;
}

function watchTimeHint(minutes: number) {
  const days = minutes / 60 / 24;
  return days >= 1 ? `≈ ${plural(Math.round(days), 'day')}` : plural(minutes, 'minute');
}

function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

export function StatsView() {
  const { data: stats, isPending, error, refetch } = useStats();
  const totals = stats?.totals;
  const withoutStatus = totals
    ? Math.max(
        0,
        totals.inCatalog -
          totals.wantToWatch -
          totals.watching -
          totals.watched -
          totals.notInterested,
      )
    : 0;

  return (
    <div>
      <PageHeader title="Stats" description="Your movie life in numbers." />
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <StatsSkeleton />
      ) : stats.totals.inCatalog === 0 && stats.totals.viewings === 0 ? (
        <EmptyState
          icon={ChartColumn}
          title="No stats yet"
          description="Mark movies as watched and rate them — your numbers appear here."
          action={
            <Button asChild>
              <Link href="/discover">Find something to watch</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-2 p-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Movies watched</p>
              <p className="text-6xl font-semibold tracking-tight">
                {stats.totals.watched.toLocaleString('en-US')}
              </p>
            </div>
            <p className="text-sm text-muted-foreground sm:text-right">
              {plural(stats.totals.viewings, 'viewing')} including rewatches
              <br />
              {watchTime(stats.totalWatchTimeMinutes)} in front of the screen
            </p>
          </Card>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Average rating"
              value={stats.averageRating !== null ? `${stats.averageRating.toFixed(1)} / 10` : '–'}
              hint={`${stats.totals.rated} rated`}
            />
            <StatTile
              label="Watch time"
              value={watchTime(stats.totalWatchTimeMinutes)}
              hint={watchTimeHint(stats.totalWatchTimeMinutes)}
            />
            <StatTile
              label="In your catalog"
              value={stats.totals.inCatalog.toLocaleString('en-US')}
            />
            <StatTile
              label="Watchlist"
              value={stats.totals.wantToWatch.toLocaleString('en-US')}
              hint={`${stats.totals.watching} watching now`}
            />
            <StatTile label="Favorites" value={stats.totals.favorites.toLocaleString('en-US')} />
            <StatTile label="Reviews" value={stats.totals.reviews.toLocaleString('en-US')} />
          </div>

          <Card className="p-5">
            <h2 className="font-semibold">Catalog at a glance</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              How your movies split by status.
              {withoutStatus > 0
                ? ` ${plural(withoutStatus, 'saved movie')} without a status ${withoutStatus === 1 ? 'is' : 'are'} not shown.`
                : ''}
            </p>
            <SegmentedBar
              caption="Catalog by status"
              segments={[
                {
                  key: 'want',
                  label: 'Want to watch',
                  value: stats.totals.wantToWatch,
                  fill: 'bg-chart-1',
                  ink: 'text-white',
                },
                {
                  key: 'watching',
                  label: 'Watching',
                  value: stats.totals.watching,
                  fill: 'bg-chart-2',
                  ink: 'text-white',
                },
                {
                  key: 'watched',
                  label: 'Watched',
                  value: stats.totals.watched,
                  fill: 'bg-chart-3',
                  ink: 'text-white',
                },
                {
                  key: 'not',
                  label: 'Not interested',
                  value: stats.totals.notInterested,
                  fill: 'bg-chart-muted',
                  ink: 'text-zinc-950 dark:text-white',
                },
              ]}
            />
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card className="p-5">
              <h2 className="font-semibold">Viewings per month</h2>
              <p className="mb-5 text-sm text-muted-foreground">
                The last 12 months, rewatches included.
              </p>
              <ColumnChart
                data={lastTwelveMonths(stats.viewingsByMonth)}
                unit={['viewing', 'viewings']}
                caption="Viewings per month"
              />
              {stats.mostActiveMonths.length > 0 ? (
                <div className="mt-5 border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Busiest months ever
                  </p>
                  <ol className="mt-2 flex flex-col gap-1 text-sm">
                    {stats.mostActiveMonths.map((month, index) => (
                      <li key={month.month} className="flex justify-between gap-4">
                        <span>
                          {index + 1}. {monthName(month.month, 'long')}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {plural(month.count, 'viewing')}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </Card>
            <Card className="p-5">
              <h2 className="font-semibold">Top genres</h2>
              <p className="mb-5 text-sm text-muted-foreground">Watched movies by genre.</p>
              {stats.topGenres.length > 0 ? (
                <RankedBars
                  caption="Watched movies by genre"
                  unit="movies"
                  items={stats.topGenres.map((genre) => ({
                    key: String(genre.id),
                    label: genre.name,
                    value: genre.count,
                  }))}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Watch a few movies to see your favorite genres.
                </p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
