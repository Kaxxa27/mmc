'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form';
import { StarRating } from '@/components/ui/misc';
import type { WatchEventView } from '@/lib/api/types';
import { useLogViewing, useUpdateViewing } from '@/lib/queries/library';
import { toIsoDate } from '@/lib/utils';

/** Log a new viewing of a movie, or edit an existing one. */
export function ViewingDialog({
  movie,
  viewing,
  open,
  onOpenChange,
}: {
  movie: { tmdbId: number; title: string };
  viewing?: WatchEventView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const today = toIsoDate(new Date());
  const [watchedOn, setWatchedOn] = useState(viewing?.watchedOn ?? today);
  const [rating, setRating] = useState<number | null>(viewing?.rating ?? null);
  const [notes, setNotes] = useState(viewing?.notes ?? '');
  const [isRewatch, setRewatch] = useState(viewing?.isRewatch ?? false);
  const log = useLogViewing();
  const update = useUpdateViewing();
  const pending = log.isPending || update.isPending;

  function save() {
    const input = { watchedOn, rating, notes: notes.trim() || null };
    const done = { onSuccess: () => onOpenChange(false) };
    if (viewing) update.mutate({ id: viewing.id, ...input, isRewatch }, done);
    // A new viewing of a movie logged before counts as a rewatch automatically.
    else log.mutate({ tmdbId: movie.tmdbId, ...input, ...(isRewatch ? { isRewatch } : {}) }, done);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={viewing ? 'Edit viewing' : 'Log a viewing'} description={movie.title}>
        <div className="flex flex-col gap-4">
          <Field label="Watched on" htmlFor="watched-on">
            <Input
              id="watched-on"
              type="date"
              value={watchedOn}
              max={today}
              onChange={(event) => setWatchedOn(event.target.value)}
            />
          </Field>
          <Field label="Rating for this viewing">
            <StarRating value={rating} onChange={setRating} />
          </Field>
          <Field label="Notes" htmlFor="viewing-notes">
            <Textarea
              id="viewing-notes"
              value={notes}
              maxLength={2000}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Where, with whom, what you thought…"
            />
          </Field>
          <Checkbox
            label="This was a rewatch"
            checked={isRewatch}
            onChange={(event) => setRewatch(event.target.checked)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={pending} disabled={!watchedOn}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
