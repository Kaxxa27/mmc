'use client';

import { Globe, Lock, NotebookPen } from 'lucide-react';
import { useState } from 'react';
import { ReviewDialog } from '@/components/movies/review-dialog';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Card, StarRating } from '@/components/ui/misc';
import { Pagination } from '@/components/ui/pagination';
import type { PublicReviewView } from '@/lib/api/types';
import { useMyReview } from '@/lib/queries/library';
import { usePublicReviews } from '@/lib/queries/movies';
import { formatDate } from '@/lib/utils';

function SpoilerText({ text, spoilers }: { text: string; spoilers: boolean }) {
  const [revealed, setRevealed] = useState(!spoilers);
  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="mt-2 w-full rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground hover:bg-muted/50"
      >
        This review contains spoilers.{' '}
        <span className="font-medium text-foreground underline">Show it anyway</span>
      </button>
    );
  }
  return <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{text}</p>;
}

function PublicReview({ review }: { review: PublicReviewView }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar name={review.author.displayName} src={review.author.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{review.author.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(review.publishedAt ?? review.updatedAt)}
          </p>
        </div>
        {review.rating ? <StarRating value={review.rating} size="sm" /> : null}
      </div>
      <SpoilerText text={review.body} spoilers={review.containsSpoilers} />
    </Card>
  );
}

export function ReviewsSection({
  tmdbId,
  title,
  signedIn,
  myRating,
  dialogOpen,
  onDialogOpenChange,
}: {
  tmdbId: number;
  title: string;
  signedIn: boolean;
  myRating: number | null;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
}) {
  const [page, setPage] = useState(1);
  const { data: mine } = useMyReview(tmdbId, signedIn);
  const { data: reviews } = usePublicReviews(tmdbId, page);
  const others = (reviews?.items ?? []).filter((review) => review.id !== mine?.id);

  return (
    <div className="flex flex-col gap-4">
      {signedIn ? (
        mine ? (
          <Card className="border-primary/30 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Your review</p>
              <Badge>
                {mine.isPublic ? <Globe aria-hidden /> : <Lock aria-hidden />}
                {mine.isPublic ? 'Public' : 'Private'}
              </Badge>
              {mine.rating ? <StarRating value={mine.rating} size="sm" /> : null}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => onDialogOpenChange(true)}
              >
                Edit
              </Button>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{mine.body}</p>
          </Card>
        ) : (
          <Button variant="outline" className="self-start" onClick={() => onDialogOpenChange(true)}>
            <NotebookPen aria-hidden />
            Write a review
          </Button>
        )
      ) : null}

      {others.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {others.map((review) => (
            <PublicReview key={review.id} review={review} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No public reviews yet.</p>
      )}
      {reviews ? (
        <Pagination page={page} totalPages={reviews.totalPages} onChange={setPage} />
      ) : null}

      {signedIn && dialogOpen ? (
        <ReviewDialog
          key={mine?.updatedAt ?? 'new'}
          tmdbId={tmdbId}
          title={title}
          review={mine ?? null}
          defaultRating={myRating}
          open={dialogOpen}
          onOpenChange={onDialogOpenChange}
        />
      ) : null}
    </div>
  );
}
