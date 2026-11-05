'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form';
import { Spinner, StarRating, Switch } from '@/components/ui/misc';
import type { LibraryEntry, MovieStatus, MovieSummary } from '@/lib/api/types';
import { MOVIE_STATUS_META, MOVIE_STATUSES } from '@/lib/constants';
import { useLibraryEntry, useUpdateLibraryEntry } from '@/lib/queries/library';
import { cn, toIsoDate } from '@/lib/utils';

type MovieRef = Pick<MovieSummary, 'tmdbId' | 'title'>;

function EntryForm({
  movie,
  entry,
  onDone,
}: {
  movie: MovieRef;
  entry: LibraryEntry | null;
  onDone: () => void;
}) {
  const [status, setStatus] = useState<MovieStatus | null>(entry?.status ?? null);
  const [isFavorite, setFavorite] = useState(entry?.isFavorite ?? false);
  const [rating, setRating] = useState<number | null>(entry?.rating ?? null);
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [logViewing, setLogViewing] = useState(false);
  const [watchedOn, setWatchedOn] = useState(toIsoDate(new Date()));
  const update = useUpdateLibraryEntry(entry ? 'Saved' : `${movie.title} added to your catalog`);

  const becameWatched = status === 'watched' && entry?.status !== 'watched';

  function save() {
    update.mutate(
      {
        tmdbId: movie.tmdbId,
        status,
        isFavorite,
        rating,
        notes: notes.trim() || null,
        // `watchedOn` logs a viewing on that date (and marks the movie as watched).
        ...(logViewing ? { watchedOn } : {}),
      },
      { onSuccess: onDone },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Status">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MOVIE_STATUSES.map((value) => {
            const meta = MOVIE_STATUS_META[value];
            const Icon = meta.icon;
            const active = status === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(active ? null : value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors',
                  active ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {meta.label}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Favorite</p>
          <p className="text-xs text-muted-foreground">Show it in your favorites list.</p>
        </div>
        <Switch checked={isFavorite} onCheckedChange={setFavorite} aria-label="Favorite" />
      </div>

      <Field
        label="Your rating"
        hint="Only you see your personal rating; TMDB ratings are separate."
      >
        <StarRating value={rating} onChange={setRating} />
      </Field>

      <Field label="Private notes" htmlFor="entry-notes">
        <Textarea
          id="entry-notes"
          value={notes}
          maxLength={2000}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Only visible to you — e.g. “Watch with the kids at Christmas”"
        />
      </Field>

      <div className="rounded-xl border p-3">
        <Checkbox
          label={becameWatched ? 'Log the viewing on a specific date' : 'Log a viewing'}
          checked={logViewing}
          onChange={(event) => {
            setLogViewing(event.target.checked);
            if (event.target.checked) setStatus('watched');
          }}
        />
        {logViewing ? (
          <Input
            type="date"
            className="mt-3"
            value={watchedOn}
            max={toIsoDate(new Date())}
            onChange={(event) => setWatchedOn(event.target.value)}
            aria-label="Watched on"
          />
        ) : becameWatched ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Without a date, marking as watched logs a viewing today.
          </p>
        ) : null}
      </div>

      <DialogFooter className="mt-1">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} loading={update.isPending}>
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

export function LibraryEntryDialog({
  movie,
  open,
  onOpenChange,
}: {
  movie: MovieRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: entry, isPending } = useLibraryEntry(movie.tmdbId, open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={movie.title}
        description="Status, personal rating, private notes and viewings."
      >
        {isPending ? (
          <Spinner />
        ) : (
          <EntryForm
            key={entry?.updatedAt ?? 'new'}
            movie={movie}
            entry={entry ?? null}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
