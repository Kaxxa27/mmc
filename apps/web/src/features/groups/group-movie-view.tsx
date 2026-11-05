'use client';

import { ArrowLeft, CalendarCheck, ExternalLink, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CommentThread } from '@/components/comments/comment-thread';
import { Poster } from '@/components/movies/poster';
import { StatusBadge, TmdbRating } from '@/components/movies/status-badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form';
import { Avatar, Card, EmptyState, ErrorState, Skeleton, StarRating } from '@/components/ui/misc';
import { ApiError } from '@/lib/api/client';
import type { GroupDetails, GroupMovieDetails, GroupRatingView } from '@/lib/api/types';
import { useMe } from '@/lib/queries/core';
import {
  useGroup,
  useGroupMovie,
  useRateGroupMovie,
  useRemoveGroupMovie,
  useRemoveGroupRating,
  useUpdateGroupMovie,
} from '@/lib/queries/groups';
import { formatDate, formatRuntime, toIsoDate } from '@/lib/utils';

function RatingForm({
  groupId,
  entry,
  disabled,
}: {
  groupId: string;
  entry: GroupMovieDetails;
  disabled: boolean;
}) {
  const { data: me } = useMe();
  const mine = entry.ratings.find((rating) => rating.user.id === me?.id);
  const [rating, setRating] = useState<number | null>(mine?.rating ?? null);
  const [review, setReview] = useState(mine?.review ?? '');
  const [spoilers, setSpoilers] = useState(mine?.containsSpoilers ?? false);
  const rate = useRateGroupMovie(groupId, entry.movie.tmdbId);
  const remove = useRemoveGroupRating(groupId, entry.movie.tmdbId);

  return (
    <div className="flex flex-col gap-3">
      <StarRating value={rating} onChange={setRating} disabled={disabled} />
      <Textarea
        value={review}
        maxLength={5000}
        rows={3}
        disabled={disabled}
        onChange={(event) => setReview(event.target.value)}
        placeholder="A few words for the group (optional)"
        aria-label="Review for the group"
      />
      <Checkbox
        label="Contains spoilers"
        checked={spoilers}
        disabled={disabled}
        onChange={(event) => setSpoilers(event.target.checked)}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={disabled || rating === null}
          loading={rate.isPending}
          onClick={() =>
            rating !== null &&
            rate.mutate({ rating, review: review.trim() || null, containsSpoilers: spoilers })
          }
        >
          {mine ? 'Update rating' : 'Rate for the group'}
        </Button>
        {mine ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function RatingItem({ rating }: { rating: GroupRatingView }) {
  const [revealed, setRevealed] = useState(!rating.containsSpoilers);
  return (
    <li className="flex gap-3 py-3">
      <Avatar name={rating.user.displayName} src={rating.user.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{rating.user.displayName}</span>
          <StarRating value={rating.rating} size="sm" />
        </div>
        {rating.review ? (
          revealed ? (
            <p className="mt-1 whitespace-pre-line text-sm">{rating.review}</p>
          ) : (
            <button
              type="button"
              className="mt-1 text-sm text-muted-foreground underline"
              onClick={() => setRevealed(true)}
            >
              Contains spoilers — show
            </button>
          )
        ) : null}
      </div>
    </li>
  );
}

function GroupStatus({ group, entry }: { group: GroupDetails; entry: GroupMovieDetails }) {
  const update = useUpdateGroupMovie(group.id, entry.movie.tmdbId);
  const [date, setDate] = useState(entry.watchedOn ?? toIsoDate(new Date()));
  const [note, setNote] = useState(entry.note ?? '');
  const disabled = group.archived;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <p className="text-sm font-semibold">In the group catalog</p>
        <p className="text-xs text-muted-foreground">
          Added by {entry.addedBy?.displayName ?? 'a former member'} on {formatDate(entry.addedAt)}
        </p>
      </div>
      {entry.status === 'watched' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-500/10 p-3 text-sm">
          <CalendarCheck className="size-4 text-emerald-600" aria-hidden />
          <span className="flex-1">
            Watched together{entry.watchedOn ? ` on ${formatDate(entry.watchedOn)}` : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            loading={update.isPending}
            onClick={() => update.mutate({ status: 'want_to_watch', watchedOn: null })}
          >
            Undo
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Watched together on" htmlFor="together-date">
            <Input
              id="together-date"
              type="date"
              value={date}
              max={toIsoDate(new Date())}
              disabled={disabled}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Button
            disabled={disabled || !date}
            loading={update.isPending}
            onClick={() => update.mutate({ status: 'watched', watchedOn: date })}
          >
            <CalendarCheck aria-hidden />
            Mark as watched together
          </Button>
        </div>
      )}
      <Field label="Group note" htmlFor="group-note">
        <div className="flex gap-2">
          <Input
            id="group-note"
            value={note}
            maxLength={1000}
            disabled={disabled}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. “Save it for the holidays”"
          />
          <Button
            variant="outline"
            disabled={disabled || note === (entry.note ?? '')}
            loading={update.isPending}
            onClick={() => update.mutate({ note: note.trim() || null })}
          >
            Save
          </Button>
        </div>
      </Field>
    </Card>
  );
}

export function GroupMovieView({ groupId, tmdbId }: { groupId: string; tmdbId: number }) {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: group } = useGroup(groupId);
  const { data: entry, isPending, error, refetch } = useGroupMovie(groupId, tmdbId);
  const remove = useRemoveGroupMovie(groupId);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          icon={ArrowLeft}
          title="Not in this group's catalog"
          description="The movie was removed, or the group no longer exists."
          action={
            <Button asChild variant="outline">
              <Link href={`/groups/${groupId}`}>Back to the group</Link>
            </Button>
          }
        />
      );
    }
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }
  if (isPending || !group) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const movie = entry.movie;
  const canRemove = !group.archived && (entry.addedBy?.id === me?.id || group.myRole !== 'member');

  return (
    <div className="flex flex-col gap-8">
      <Link
        href={`/groups/${groupId}`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {group.name}
      </Link>

      <div className="flex flex-col gap-6 md:flex-row">
        <Poster
          src={movie.posterUrl}
          title={movie.title}
          className="w-40 shrink-0 self-start shadow-xl sm:w-52"
          priority
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {movie.title}{' '}
            {movie.releaseYear ? (
              <span className="font-normal text-muted-foreground">({movie.releaseYear})</span>
            ) : null}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {movie.runtime ? <span>{formatRuntime(movie.runtime)}</span> : null}
            {movie.genres.length ? (
              <span>{movie.genres.map((genre) => genre.name).join(', ')}</span>
            ) : null}
            <TmdbRating value={movie.voteAverage} className="text-foreground" />
          </p>
          {movie.overview ? (
            <p className="mt-3 line-clamp-4 max-w-3xl text-sm leading-relaxed">{movie.overview}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/movies/${movie.tmdbId}`}>
                <ExternalLink aria-hidden />
                Movie page
              </Link>
            </Button>
            {canRemove ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)}>
                <Trash2 aria-hidden />
                Remove from group
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <GroupStatus
            key={`${entry.status}-${entry.watchedOn}-${entry.note}`}
            group={group}
            entry={entry}
          />

          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Group ratings</h2>
              <p className="text-sm text-muted-foreground">
                {entry.groupRating.average !== null ? (
                  <>
                    <span className="text-lg font-semibold text-foreground">
                      {entry.groupRating.average.toFixed(1)}
                    </span>{' '}
                    / 10 · {entry.groupRating.count}{' '}
                    {entry.groupRating.count === 1 ? 'rating' : 'ratings'}
                  </>
                ) : (
                  'No ratings yet'
                )}
              </p>
            </div>
            <div className="mt-4">
              <RatingForm
                key={entry.groupRating.mine ?? 'none'}
                groupId={groupId}
                entry={entry}
                disabled={group.archived}
              />
            </div>
            {entry.ratings.length > 0 ? (
              <ul className="mt-4 divide-y border-t">
                {entry.ratings.map((rating) => (
                  <RatingItem key={rating.user.id} rating={rating} />
                ))}
              </ul>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 font-semibold">Comments ({entry.commentCount})</h2>
            <CommentThread
              target={{ kind: 'group-movie', groupId, tmdbId }}
              canComment={!group.archived}
            />
          </Card>
        </div>

        <aside>
          <Card className="p-5">
            <h2 className="font-semibold">Who has seen it</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              From each member&apos;s personal catalog.
            </p>
            <ul className="flex flex-col gap-2">
              {entry.members.map((member) => (
                <li key={member.userId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{member.displayName}</span>
                  {member.status ? (
                    <StatusBadge status={member.status} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${movie.title} from ${group.name}?`}
        description="The group ratings for this movie are removed too."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(tmdbId, { onSuccess: () => router.replace(`/groups/${groupId}`) })
        }
      />
    </div>
  );
}
