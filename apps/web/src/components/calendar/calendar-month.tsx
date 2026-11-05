'use client';

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Popcorn,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import type { CalendarEvent } from '@/lib/api/types';
import { useIsClient } from '@/hooks/use-is-client';
import { useCalendar } from '@/lib/queries/discovery';
import { cn, formatDate, toIsoDate } from '@/lib/utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPE_META: Record<CalendarEvent['type'], { label: string; icon: typeof Eye; dot: string }> = {
  movie_night: { label: 'Movie night', icon: Popcorn, dot: 'bg-primary' },
  viewing: { label: 'Watched', icon: Eye, dot: 'bg-chart-1' },
  watched_together: { label: 'Watched together', icon: Users, dot: 'bg-chart-2' },
  release: { label: 'Release', icon: Sparkles, dot: 'bg-chart-3' },
};

function eventHref(event: CalendarEvent): string {
  switch (event.type) {
    case 'movie_night':
      return `/movie-nights/${event.id}`;
    case 'watched_together':
      return `/groups/${event.group.id}/movies/${event.movie.tmdbId}`;
    default:
      return `/movies/${event.movie.tmdbId}`;
  }
}

function eventTitle(event: CalendarEvent): string {
  switch (event.type) {
    case 'movie_night':
      return event.selectedMovie ? `${event.title}: ${event.selectedMovie.title}` : event.title;
    case 'watched_together':
      return `${event.movie.title} · ${event.group.name}`;
    default:
      return event.movie.title;
  }
}

function eventKey(event: CalendarEvent, index: number) {
  return `${event.type}-${'id' in event ? event.id : event.movie.tmdbId}-${index}`;
}

function EventChip({ event }: { event: CalendarEvent }) {
  const meta = TYPE_META[event.type];
  return (
    <Link
      href={eventHref(event)}
      className="flex items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-[11px] leading-tight transition-colors hover:bg-muted"
      title={`${meta.label}: ${eventTitle(event)}`}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', meta.dot)} aria-hidden />
      <span className="truncate">
        {event.type === 'movie_night'
          ? `${new Date(event.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} `
          : ''}
        {eventTitle(event)}
      </span>
    </Link>
  );
}

function monthRange(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { first, last, from: toIsoDate(first), to: toIsoDate(last) };
}

/** Month calendar of viewings, movie nights, watchlist releases and group viewings. */
export function CalendarMonth({ groupId }: { groupId?: string }) {
  // "Today" and the current month come from the viewer's clock, so render after hydration.
  const isClient = useIsClient();
  return isClient ? (
    <MonthView groupId={groupId} />
  ) : (
    <Skeleton className="h-[32rem] rounded-2xl" />
  );
}

function MonthView({ groupId }: { groupId?: string }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const { first, last, from, to } = monthRange(month);
  const { data, isPending, error, refetch, isPlaceholderData } = useCalendar({ from, to }, groupId);
  const today = toIsoDate(new Date());

  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of data?.events ?? []) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }

  // Monday-first grid with leading/trailing days from the neighbouring months.
  const leading = (first.getDay() + 6) % 7;
  const cells: Date[] = [];
  for (let offset = -leading; ; offset += 1) {
    const day = new Date(first.getFullYear(), first.getMonth(), 1 + offset);
    if (offset >= 0 && day > last && cells.length % 7 === 0) break;
    cells.push(day);
  }
  const agenda = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));

  function shift(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => shift(-1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <h2 className="min-w-40 text-center text-lg font-semibold">
            {formatDate(from, { month: 'long', year: 'numeric' })}
          </h2>
          <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            Today
          </Button>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {Object.entries(TYPE_META)
            .filter(([type]) => !groupId || type !== 'release')
            .map(([type, meta]) => (
              <li key={type} className="flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', meta.dot)} aria-hidden />
                {meta.label}
              </li>
            ))}
        </ul>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <Skeleton className="h-[32rem] rounded-2xl" />
      ) : (
        <div className={cn(isPlaceholderData && 'opacity-60 transition-opacity')}>
          <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-2 py-2 text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day) => {
                const key = toIsoDate(day);
                const events = byDate.get(key) ?? [];
                const outside = day.getMonth() !== month.getMonth();
                return (
                  <div
                    key={key}
                    className={cn(
                      'min-h-28 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0',
                      outside && 'bg-muted/30',
                    )}
                  >
                    <span
                      className={cn(
                        'mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs',
                        key === today
                          ? 'bg-primary font-semibold text-primary-foreground'
                          : outside
                            ? 'text-muted-foreground/60'
                            : 'text-muted-foreground',
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {events.slice(0, 3).map((event, index) => (
                        <EventChip key={eventKey(event, index)} event={event} />
                      ))}
                      {events.length > 3 ? (
                        <span className="px-1.5 text-[11px] text-muted-foreground">
                          +{events.length - 3} more
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="md:hidden">
            {agenda.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nothing this month"
                description="Viewings, movie nights and releases show up here."
              />
            ) : (
              <ol className="flex flex-col gap-4">
                {agenda.map(([date, events]) => (
                  <li key={date}>
                    <p
                      className={cn('mb-1 text-sm font-semibold', date === today && 'text-primary')}
                    >
                      {formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                    <div className="flex flex-col gap-1 rounded-xl border bg-card p-2">
                      {events.map((event, index) => {
                        const meta = TYPE_META[event.type];
                        const Icon = meta.icon;
                        return (
                          <Link
                            key={eventKey(event, index)}
                            href={eventHref(event)}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                          >
                            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="text-xs text-muted-foreground">{meta.label}</span>
                            <span className="truncate">{eventTitle(event)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {agenda.length === 0 ? (
            <p className="mt-4 hidden text-center text-sm text-muted-foreground md:block">
              Nothing planned or watched in this month.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
