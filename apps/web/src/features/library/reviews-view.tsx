'use client';

import { Globe, Lock, NotebookPen, Pencil, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Poster } from '@/components/movies/poster';
import { ReviewDialog } from '@/components/movies/review-dialog';
import { Button } from '@/components/ui/button';
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
import type { ReviewView } from '@/lib/api/types';
import { useMyReviews } from '@/lib/queries/library';
import { formatDate } from '@/lib/utils';

export function ReviewsView() {
  const [page, setPage] = useState(1);
  const { data, isPending, error, refetch } = useMyReviews(page);
  const [editing, setEditing] = useState<ReviewView | null>(null);

  return (
    <div>
      <PageHeader
        title="My reviews"
        description="Private notes to yourself, or public reviews shown on the movie page."
      />
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No reviews yet"
          description="Open any movie and choose “Write a review”. Reviews are private unless you publish them."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {data.items.map((review) => (
            <Card key={review.id} className="flex gap-4 p-4">
              <Link href={`/movies/${review.movie.tmdbId}`} className="shrink-0">
                <Poster
                  src={review.movie.posterUrl}
                  title={review.movie.title}
                  className="w-20 rounded-lg"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/movies/${review.movie.tmdbId}`}
                    className="font-semibold hover:underline"
                  >
                    {review.movie.title}
                  </Link>
                  {review.movie.releaseYear ? (
                    <span className="text-sm text-muted-foreground">
                      {review.movie.releaseYear}
                    </span>
                  ) : null}
                  <Badge>
                    {review.isPublic ? <Globe aria-hidden /> : <Lock aria-hidden />}
                    {review.isPublic ? 'Public' : 'Private'}
                  </Badge>
                  {review.containsSpoilers ? (
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      <TriangleAlert aria-hidden />
                      Spoilers
                    </Badge>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setEditing(review)}
                  >
                    <Pencil aria-hidden />
                    Edit
                  </Button>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  {review.rating ? <StarRating value={review.rating} size="sm" /> : null}
                  <span>Updated {formatDate(review.updatedAt)}</span>
                </div>
                <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed">
                  {review.body}
                </p>
              </div>
            </Card>
          ))}
          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}
      {editing ? (
        <ReviewDialog
          key={editing.id}
          tmdbId={editing.movie.tmdbId}
          title={editing.movie.title}
          review={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
    </div>
  );
}
