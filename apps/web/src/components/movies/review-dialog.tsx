'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/form';
import { StarRating, Switch } from '@/components/ui/misc';
import type { ReviewView } from '@/lib/api/types';
import { useDeleteReview, useSaveReview } from '@/lib/queries/library';

export function ReviewDialog({
  tmdbId,
  title,
  review,
  defaultRating,
  open,
  onOpenChange,
}: {
  tmdbId: number;
  title: string;
  review: ReviewView | null;
  defaultRating?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [body, setBody] = useState(review?.body ?? '');
  const [rating, setRating] = useState<number | null>(review?.rating ?? defaultRating ?? null);
  const [containsSpoilers, setSpoilers] = useState(review?.containsSpoilers ?? false);
  const [isPublic, setPublic] = useState(review?.isPublic ?? false);
  const save = useSaveReview();
  const remove = useDeleteReview();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={review ? 'Edit your review' : 'Write a review'}
        description={title}
        size="lg"
      >
        <div className="flex flex-col gap-5">
          <Field label="Rating" hint="Also updates the rating in your catalog.">
            <StarRating value={rating} onChange={setRating} />
          </Field>
          <Field label="Review" htmlFor="review-body">
            <Textarea
              id="review-body"
              value={body}
              rows={8}
              maxLength={10_000}
              onChange={(event) => setBody(event.target.value)}
              placeholder="What did you think?"
            />
          </Field>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Contains spoilers</p>
              <p className="text-xs text-muted-foreground">
                Readers see a warning before the text.
              </p>
            </div>
            <Switch
              checked={containsSpoilers}
              onCheckedChange={setSpoilers}
              aria-label="Contains spoilers"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Public</p>
              <p className="text-xs text-muted-foreground">
                Show it on the movie page. Reviews are private by default.
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setPublic} aria-label="Public review" />
          </div>
        </div>
        <DialogFooter>
          {review ? (
            <Button
              variant="ghost"
              className="text-red-600 sm:mr-auto"
              loading={remove.isPending}
              onClick={() => remove.mutate(tmdbId, { onSuccess: () => onOpenChange(false) })}
            >
              Delete review
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!body.trim()}
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                { tmdbId, body: body.trim(), rating, containsSpoilers, isPublic },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            Save review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
