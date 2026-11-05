'use client';

import {
  ArrowLeft,
  CalendarClock,
  CircleCheck,
  Dices,
  Ellipsis,
  Pencil,
  Plus,
  Popcorn,
  Sparkles,
  Trash2,
  Trophy,
  Vote,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { CommentThread } from '@/components/comments/comment-thread';
import { MoviePickerDialog } from '@/components/movies/movie-picker-dialog';
import { Poster } from '@/components/movies/poster';
import { TmdbRating } from '@/components/movies/status-badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Spinner,
  StarRating,
} from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api/client';
import type { CandidateView, MovieNightDetails } from '@/lib/api/types';
import { MOVIE_NIGHT_STATUS_META } from '@/lib/constants';
import { useGroup } from '@/lib/queries/groups';
import {
  useDeleteMovieNight,
  useLogMovieNightViewing,
  useMovieNight,
  useMovieNightAction,
  useSuggestions,
} from '@/lib/queries/movie-nights';
import { cn, formatDate, formatDateTime, formatRuntime, plural, toIsoDate } from '@/lib/utils';
import { MovieNightFormDialog } from './movie-night-form-dialog';

function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function CandidateCard({
  candidate,
  night,
  onRemove,
  onVote,
  voting,
}: {
  candidate: CandidateView;
  night: MovieNightDetails;
  onRemove?: () => void;
  onVote?: () => void;
  voting?: boolean;
}) {
  const { movie } = candidate;
  const mine = night.myVoteTmdbId === movie.tmdbId;
  const share = night.votesCast ? Math.round((candidate.votes / night.votesCast) * 100) : 0;
  return (
    <li
      className={cn(
        'flex gap-3 rounded-2xl border bg-card p-3',
        mine && 'border-primary ring-1 ring-primary',
      )}
    >
      <Link href={`/movies/${movie.tmdbId}`} className="shrink-0">
        <Poster src={movie.posterUrl} title={movie.title} className="w-16 rounded-lg" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/movies/${movie.tmdbId}`}
          className="line-clamp-2 font-medium leading-snug hover:underline"
        >
          {movie.title}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {movie.releaseYear ? <span>{movie.releaseYear}</span> : null}
          {movie.runtime ? <span>{formatRuntime(movie.runtime)}</span> : null}
          <TmdbRating value={movie.voteAverage} />
        </p>
        {candidate.addedBy ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Suggested by {candidate.addedBy.displayName}
          </p>
        ) : null}
        {night.status !== 'planning' ? (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{plural(candidate.votes, 'vote')}</span>
              <span className="tabular-nums text-muted-foreground">{share}%</span>
            </div>
            {/* Vote share meter: same-hue track, fill grows with the share. */}
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-chart-1/20">
              <div className="h-full rounded-full bg-chart-1" style={{ width: `${share}%` }} />
            </div>
            {candidate.voters && candidate.voters.length > 0 ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {candidate.voters.map((voter) => voter.displayName).join(', ')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {onVote ? (
          <Button
            size="sm"
            variant={mine ? 'primary' : 'outline'}
            loading={voting}
            onClick={onVote}
            aria-pressed={mine}
          >
            <Vote aria-hidden />
            {mine ? 'Your vote' : 'Vote'}
          </Button>
        ) : null}
        {onRemove ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${movie.title}`}
            onClick={onRemove}
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function Suggestions({ night }: { night: MovieNightDetails }) {
  const { data: suggestions, isPending } = useSuggestions(night.id, true);
  const add = useMovieNightAction(night.id, (base, tmdbId: number) =>
    api.post<MovieNightDetails>(`${base}/candidates`, { tmdbIds: [tmdbId] }),
  );
  const addTop = useMovieNightAction(
    night.id,
    (base) => api.post<MovieNightDetails>(`${base}/candidates/suggested`, { limit: 5 }),
    'Top suggestions added',
  );
  const candidateIds = new Set(night.candidates.map((candidate) => candidate.movie.tmdbId));
  const visible = (suggestions ?? []).filter(
    (suggestion) => !candidateIds.has(suggestion.movie.tmdbId),
  );

  return (
    <Section
      title="Suggestions for this group"
      actions={
        night.permissions.canManage && visible.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            loading={addTop.isPending}
            onClick={() => addTop.mutate()}
          >
            <Sparkles aria-hidden />
            Add top 5
          </Button>
        ) : null
      }
    >
      {isPending ? (
        <Spinner className="py-6" />
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No more suggestions match the criteria. Search for a movie instead.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {visible.map((suggestion) => (
            <li key={suggestion.movie.tmdbId} className="flex gap-3 rounded-2xl border bg-card p-3">
              <Poster
                src={suggestion.movie.posterUrl}
                title={suggestion.movie.title}
                className="w-12 shrink-0 rounded-md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{suggestion.movie.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[suggestion.movie.releaseYear, formatRuntime(suggestion.movie.runtime)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {suggestion.reasons.length > 0 ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {suggestion.reasons.join(' · ')}
                  </p>
                ) : null}
              </div>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Add ${suggestion.movie.title} as a candidate`}
                loading={add.isPending && add.variables === suggestion.movie.tmdbId}
                onClick={() => add.mutate(suggestion.movie.tmdbId)}
              >
                <Plus aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ChooseMovieDialog({
  night,
  open,
  onOpenChange,
}: {
  night: MovieNightDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const select = useMovieNightAction(
    night.id,
    (base, tmdbId: number) => api.post<MovieNightDetails>(`${base}/select`, { tmdbId }),
    'Movie selected',
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Choose the movie" description="Skip the vote and decide yourself.">
        {night.candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add candidates first.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {night.candidates.map((candidate) => (
              <li key={candidate.movie.tmdbId} className="flex items-center gap-3">
                <Poster
                  src={candidate.movie.posterUrl}
                  title={candidate.movie.title}
                  className="w-10 rounded-md"
                />
                <span className="flex-1 truncate text-sm font-medium">{candidate.movie.title}</span>
                <Button
                  size="sm"
                  variant="outline"
                  loading={select.isPending && select.variables === candidate.movie.tmdbId}
                  onClick={() =>
                    select.mutate(candidate.movie.tmdbId, { onSuccess: () => onOpenChange(false) })
                  }
                >
                  Choose
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CloseVotingDialog({
  night,
  open,
  onOpenChange,
}: {
  night: MovieNightDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const top = Math.max(0, ...night.candidates.map((candidate) => candidate.votes));
  const leaders = night.candidates.filter((candidate) => candidate.votes === top && top > 0);
  const [tieBreaker, setTieBreaker] = useState('');
  const close = useMovieNightAction(
    night.id,
    (base) =>
      api.post<MovieNightDetails>(
        `${base}/voting/close`,
        tieBreaker ? { tieBreakerTmdbId: Number(tieBreaker) } : {},
      ),
    'Voting closed — the movie is decided',
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Close voting?"
        description={`${night.votesCast} of ${night.participants.length} participants voted. The movie with the most votes wins.`}
        size="sm"
      >
        {leaders.length > 1 ? (
          <Field
            label="It's a tie — who decides?"
            htmlFor="tie-breaker"
            hint="Leave on random to let chance pick among the leaders."
          >
            <Select
              id="tie-breaker"
              value={tieBreaker}
              onChange={(event) => setTieBreaker(event.target.value)}
            >
              <option value="">Random among the leaders</option>
              {leaders.map((candidate) => (
                <option key={candidate.movie.tmdbId} value={candidate.movie.tmdbId}>
                  {candidate.movie.title}
                </option>
              ))}
            </Select>
          </Field>
        ) : top === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nobody has voted yet — wait for votes, pick at random, or choose a movie.
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={top === 0}
            loading={close.isPending}
            onClick={() => close.mutate(undefined, { onSuccess: () => onOpenChange(false) })}
          >
            Close voting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogViewingCard({ night }: { night: MovieNightDetails }) {
  const [rating, setRating] = useState<number | null>(null);
  const [date, setDate] = useState(() =>
    night.scheduledAt ? toIsoDate(new Date(night.scheduledAt)) : toIsoDate(new Date()),
  );
  const log = useLogMovieNightViewing(night.id);
  if (!night.permissions.isParticipant) return null;
  return (
    <Card className="p-5">
      <h3 className="font-semibold">Watched it?</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Add it to your history and rate it — your rating counts toward the group score.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <StarRating value={rating} onChange={setRating} />
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Watched on" htmlFor="night-watched-on">
            <Input
              id="night-watched-on"
              type="date"
              value={date}
              max={toIsoDate(new Date())}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Button
            loading={log.isPending}
            onClick={() => log.mutate({ watchedOn: date, ...(rating ? { rating } : {}) })}
          >
            <CircleCheck aria-hidden />
            Add to my history
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EditMovieNight({ night, onClose }: { night: MovieNightDetails; onClose: () => void }) {
  const { data: group } = useGroup(night.group.id);
  if (!group) return null;
  return (
    <MovieNightFormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      groupId={group.id}
      members={group.members}
      movieNight={night}
    />
  );
}

export function MovieNightView({ movieNightId }: { movieNightId: string }) {
  const router = useRouter();
  const { data: night, isPending, error, refetch } = useMovieNight(movieNightId);
  const [dialog, setDialog] = useState<
    'edit' | 'pick' | 'choose' | 'close' | 'cancel' | 'delete' | null
  >(null);

  const removeCandidate = useMovieNightAction(movieNightId, (base, tmdbId: number) =>
    api.delete<MovieNightDetails>(`${base}/candidates/${tmdbId}`),
  );
  const addCandidate = useMovieNightAction(movieNightId, (base, tmdbId: number) =>
    api.post<MovieNightDetails>(`${base}/candidates`, { tmdbIds: [tmdbId] }),
  );
  const startVoting = useMovieNightAction(
    movieNightId,
    (base) => api.post<MovieNightDetails>(`${base}/voting/start`),
    'Voting started — participants were notified',
  );
  const vote = useMovieNightAction(movieNightId, (base, tmdbId: number) =>
    api.put<MovieNightDetails>(`${base}/vote`, { tmdbId }),
  );
  const withdraw = useMovieNightAction(
    movieNightId,
    (base) => api.delete<MovieNightDetails>(`${base}/vote`),
    'Vote withdrawn',
  );
  const pickRandom = useMovieNightAction(
    movieNightId,
    (base) => api.post<MovieNightDetails>(`${base}/pick-random`),
    'Chance has decided!',
  );
  const complete = useMovieNightAction(
    movieNightId,
    (base) => api.post<MovieNightDetails>(`${base}/complete`),
    'Movie night completed',
  );
  const cancel = useMovieNightAction(
    movieNightId,
    (base) => api.post<MovieNightDetails>(`${base}/cancel`),
    'Movie night cancelled',
  );
  const remove = useDeleteMovieNight();

  if (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return (
        <EmptyState
          icon={Popcorn}
          title="Movie night not found"
          description="It was deleted, or you are not in this group."
          action={
            <Button asChild variant="outline">
              <Link href="/movie-nights">All movie nights</Link>
            </Button>
          }
        />
      );
    }
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }
  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const { permissions } = night;
  const status = MOVIE_NIGHT_STATUS_META[night.status];
  const open = night.status === 'planning' || night.status === 'voting';
  const canRemoveCandidates = permissions.canAddCandidates;

  return (
    <div className="flex flex-col gap-8">
      <Link
        href={`/groups/${night.group.id}?tab=movie-nights`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {night.group.name}
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Badge className={status.badge}>{status.label}</Badge>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{night.title}</h1>
          <p className="mt-2 flex items-center gap-2 text-muted-foreground">
            <CalendarClock className="size-4" aria-hidden />
            {night.scheduledAt ? formatDateTime(night.scheduledAt) : 'No date set yet'}
          </p>
          {night.description ? <p className="mt-2 max-w-2xl">{night.description}</p> : null}
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex -space-x-2">
              {night.participants.slice(0, 8).map((person) => (
                <Avatar
                  key={person.id}
                  name={person.displayName}
                  src={person.avatarUrl}
                  size="xs"
                  className="ring-2 ring-background"
                />
              ))}
            </span>
            {plural(night.participants.length, 'participant')}
            {night.createdBy ? ` · planned by ${night.createdBy.displayName}` : ''}
          </div>
        </div>
        {permissions.canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Movie night actions">
                <Ellipsis aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52">
              {open ? (
                <DropdownMenuItem onSelect={() => setDialog('edit')}>
                  <Pencil aria-hidden />
                  Edit details
                </DropdownMenuItem>
              ) : null}
              {night.status !== 'completed' && night.status !== 'cancelled' ? (
                <DropdownMenuItem onSelect={() => setDialog('cancel')}>
                  <X aria-hidden />
                  Cancel movie night
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setDialog('delete')}>
                <Trash2 aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {night.status === 'cancelled' ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm">
          This movie night was cancelled
          {night.cancelledAt ? ` on ${formatDate(night.cancelledAt)}` : ''}.
        </div>
      ) : null}

      {night.selectedMovie && (night.status === 'decided' || night.status === 'completed') ? (
        <Card className="flex flex-col gap-5 overflow-hidden p-5 sm:flex-row">
          <Poster
            src={night.selectedMovie.posterUrl}
            title={night.selectedMovie.title}
            className="w-36 shrink-0 self-start shadow-lg"
            priority
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <Trophy className="size-4" aria-hidden />
              {night.decisionMethod === 'vote'
                ? 'Chosen by vote'
                : night.decisionMethod === 'random'
                  ? 'Picked at random'
                  : 'Chosen by the organiser'}
              {night.decidedBy ? ` · ${night.decidedBy.displayName}` : ''}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{night.selectedMovie.title}</h2>
            <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
              {night.selectedMovie.releaseYear ? (
                <span>{night.selectedMovie.releaseYear}</span>
              ) : null}
              {night.selectedMovie.runtime ? (
                <span>{formatRuntime(night.selectedMovie.runtime)}</span>
              ) : null}
              <TmdbRating value={night.selectedMovie.voteAverage} />
            </p>
            {night.selectedMovie.overview ? (
              <p className="mt-3 line-clamp-4 text-sm leading-relaxed">
                {night.selectedMovie.overview}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/movies/${night.selectedMovie.tmdbId}`}>Movie page</Link>
              </Button>
              {permissions.canManage && night.status === 'decided' ? (
                <>
                  <Button size="sm" loading={complete.isPending} onClick={() => complete.mutate()}>
                    <CircleCheck aria-hidden />
                    We watched it
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDialog('choose')}>
                    Change the movie
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {night.status === 'decided' || night.status === 'completed' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <LogViewingCard night={night} />
          {night.finalRatings ? (
            <Card className="p-5">
              <h3 className="font-semibold">Group verdict</h3>
              <p className="mt-1 text-3xl font-semibold">
                {night.finalRatings.average?.toFixed(1) ?? '–'}{' '}
                <span className="text-base font-normal text-muted-foreground">/ 10</span>
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {night.finalRatings.ratings.map((entry) => (
                  <li
                    key={entry.user.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Avatar name={entry.user.displayName} src={entry.user.avatarUrl} size="xs" />
                      {entry.user.displayName}
                    </span>
                    <StarRating value={entry.rating} size="sm" />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : null}

      {open || night.candidates.length > 0 ? (
        <Section
          title={
            night.status === 'voting'
              ? `Vote (${night.votesCast} of ${night.participants.length} voted)`
              : 'Candidates'
          }
          actions={
            <>
              {permissions.canAddCandidates ? (
                <Button variant="outline" size="sm" onClick={() => setDialog('pick')}>
                  <Plus aria-hidden />
                  Add a movie
                </Button>
              ) : null}
              {night.status === 'voting' && night.myVoteTmdbId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={withdraw.isPending}
                  onClick={() => withdraw.mutate()}
                >
                  Withdraw my vote
                </Button>
              ) : null}
            </>
          }
        >
          {night.candidates.length === 0 ? (
            <EmptyState
              icon={Popcorn}
              title="No candidates yet"
              description="Add movies from the suggestions below or search for one. You need at least two to start a vote."
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {night.candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.movie.tmdbId}
                  candidate={candidate}
                  night={night}
                  onVote={
                    permissions.canVote ? () => vote.mutate(candidate.movie.tmdbId) : undefined
                  }
                  voting={vote.isPending && vote.variables === candidate.movie.tmdbId}
                  onRemove={
                    canRemoveCandidates && open && night.status === 'planning'
                      ? () => removeCandidate.mutate(candidate.movie.tmdbId)
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
          {permissions.canManage && open ? (
            <div className="mt-4 flex flex-wrap gap-2 rounded-2xl bg-muted/60 p-3">
              {night.status === 'planning' ? (
                <Button
                  disabled={night.candidates.length < 2}
                  loading={startVoting.isPending}
                  onClick={() => startVoting.mutate()}
                >
                  <Vote aria-hidden />
                  Start voting
                </Button>
              ) : (
                <Button onClick={() => setDialog('close')}>
                  <Trophy aria-hidden />
                  Close voting
                </Button>
              )}
              <Button
                variant="outline"
                loading={pickRandom.isPending}
                onClick={() => pickRandom.mutate()}
              >
                <Dices aria-hidden />
                Pick at random
              </Button>
              <Button
                variant="outline"
                disabled={night.candidates.length === 0}
                onClick={() => setDialog('choose')}
              >
                Choose a movie
              </Button>
            </div>
          ) : null}
        </Section>
      ) : null}

      {open && permissions.canAddCandidates ? <Suggestions night={night} /> : null}

      <Card className="p-5">
        <h2 className="mb-2 font-semibold">Comments</h2>
        <CommentThread
          target={{ kind: 'movie-night', groupId: night.group.id, movieNightId: night.id }}
          canComment={night.status !== 'cancelled'}
        />
      </Card>

      {dialog === 'edit' ? <EditMovieNight night={night} onClose={() => setDialog(null)} /> : null}
      {dialog === 'pick' ? (
        <MoviePickerDialog
          open
          onOpenChange={(value) => !value && setDialog(null)}
          title="Add a candidate"
          excludeIds={night.candidates.map((candidate) => candidate.movie.tmdbId)}
          onPick={(movie) => addCandidate.mutateAsync(movie.tmdbId)}
        />
      ) : null}
      {dialog === 'choose' ? (
        <ChooseMovieDialog night={night} open onOpenChange={(value) => !value && setDialog(null)} />
      ) : null}
      {dialog === 'close' ? (
        <CloseVotingDialog night={night} open onOpenChange={(value) => !value && setDialog(null)} />
      ) : null}
      <ConfirmDialog
        open={dialog === 'cancel'}
        onOpenChange={(value) => !value && setDialog(null)}
        title="Cancel this movie night?"
        description="Participants will see it as cancelled. You can still delete it later."
        confirmLabel="Cancel movie night"
        destructive
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined, { onSuccess: () => setDialog(null) })}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(value) => !value && setDialog(null)}
        title="Delete this movie night?"
        description="Candidates, votes and comments are removed for everyone."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(night.id, {
            onSuccess: () => router.replace(`/groups/${night.group.id}?tab=movie-nights`),
          })
        }
      />
    </div>
  );
}
