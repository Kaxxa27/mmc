'use client';

import { History, Pencil, Plus, Popcorn, Repeat, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { MoviePickerDialog } from '@/components/movies/movie-picker-dialog';
import { Poster } from '@/components/movies/poster';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Input } from '@/components/ui/form';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StarRating,
} from '@/components/ui/misc';
import { Pagination } from '@/components/ui/pagination';
import { useUrlState } from '@/hooks/use-url-state';
import type { MovieSummary, WatchEventView } from '@/lib/api/types';
import { useDeleteViewing, useHistory } from '@/lib/queries/library';
import { formatDate, formatRuntime } from '@/lib/utils';
import { ViewingDialog } from './viewing-dialog';

function monthLabel(date: string) {
  return formatDate(`${date.slice(0, 7)}-15`, { month: 'long', year: 'numeric' });
}

function ViewingRow({
  viewing,
  onEdit,
  onDelete,
}: {
  viewing: WatchEventView;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const day = new Date(`${viewing.watchedOn}T12:00:00`);
  return (
    <li className="flex gap-4 py-4">
      <div className="w-12 shrink-0 text-center">
        <p className="text-2xl font-bold leading-none tabular-nums">{day.getDate()}</p>
        <p className="mt-1 text-xs uppercase text-muted-foreground">
          {day.toLocaleDateString('en-US', { weekday: 'short' })}
        </p>
      </div>
      <Link href={`/movies/${viewing.movie.tmdbId}`} className="shrink-0">
        <Poster
          src={viewing.movie.posterUrl}
          title={viewing.movie.title}
          className="w-14 rounded-lg"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/movies/${viewing.movie.tmdbId}`} className="font-medium hover:underline">
          {viewing.movie.title}
        </Link>
        <p className="text-xs text-muted-foreground">
          {[viewing.movie.releaseYear, formatRuntime(viewing.movie.runtime)]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {viewing.rating ? <StarRating value={viewing.rating} size="sm" /> : null}
          {viewing.isRewatch ? (
            <Badge>
              <Repeat aria-hidden />
              Rewatch
            </Badge>
          ) : null}
          {viewing.movieNightId ? (
            <Link href={`/movie-nights/${viewing.movieNightId}`}>
              <Badge className="bg-primary/10 text-primary">
                <Popcorn aria-hidden />
                Movie night
              </Badge>
            </Link>
          ) : null}
        </div>
        {viewing.notes ? (
          <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">
            {viewing.notes}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Edit viewing" onClick={onEdit}>
          <Pencil aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Delete viewing" onClick={onDelete}>
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
}

export function HistoryView() {
  const url = useUrlState();
  const from = url.get('from');
  const to = url.get('to');
  const { data, isPending, error, refetch } = useHistory({ page: url.page, from, to });
  const remove = useDeleteViewing();
  const [editing, setEditing] = useState<WatchEventView | null>(null);
  const [deleting, setDeleting] = useState<WatchEventView | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [logging, setLogging] = useState<MovieSummary | null>(null);

  const months: { key: string; items: WatchEventView[] }[] = [];
  for (const viewing of data?.items ?? []) {
    const key = viewing.watchedOn.slice(0, 7);
    const last = months.at(-1);
    if (last?.key === key) last.items.push(viewing);
    else months.push({ key, items: [viewing] });
  }

  return (
    <div>
      <PageHeader
        title="History"
        description="Every viewing you logged, including rewatches and movie nights."
        actions={
          <Button onClick={() => setPickerOpen(true)}>
            <Plus aria-hidden />
            Log a viewing
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Field label="From" htmlFor="h-from">
          <Input
            id="h-from"
            type="date"
            value={from ?? ''}
            onChange={(event) => url.set({ from: event.target.value || null })}
            className="w-44"
          />
        </Field>
        <Field label="To" htmlFor="h-to">
          <Input
            id="h-to"
            type="date"
            value={to ?? ''}
            onChange={(event) => url.set({ to: event.target.value || null })}
            className="w-44"
          />
        </Field>
        {from || to ? (
          <Button variant="ghost" size="sm" onClick={() => url.set({ from: null, to: null })}>
            <X aria-hidden />
            Clear dates
          </Button>
        ) : null}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={History}
          title={from || to ? 'No viewings in this period' : 'No viewings yet'}
          description="Mark a movie as watched or log a viewing to start your history."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {months.map((month) => (
            <section key={month.key}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {monthLabel(month.key)}
              </h2>
              <Card className="px-4">
                <ul className="divide-y">
                  {month.items.map((viewing) => (
                    <ViewingRow
                      key={viewing.id}
                      viewing={viewing}
                      onEdit={() => setEditing(viewing)}
                      onDelete={() => setDeleting(viewing)}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
          <Pagination
            page={url.page}
            totalPages={data.totalPages}
            onChange={(page) => url.set({ page }, { keepPage: true })}
          />
        </div>
      )}

      <MoviePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Log a viewing"
        description="Find the movie you watched."
        actionLabel="Select"
        onPick={async (movie) => {
          setPickerOpen(false);
          setLogging(movie);
        }}
      />
      {logging ? (
        <ViewingDialog movie={logging} open onOpenChange={(open) => !open && setLogging(null)} />
      ) : null}
      {editing ? (
        <ViewingDialog
          key={editing.id}
          movie={editing.movie}
          viewing={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this viewing?"
        description={
          deleting ? `${deleting.movie.title}, ${formatDate(deleting.watchedOn)}` : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </div>
  );
}
