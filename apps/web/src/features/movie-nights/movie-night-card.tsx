import { CalendarClock, Popcorn, Users } from 'lucide-react';
import Link from 'next/link';
import { Poster } from '@/components/movies/poster';
import { Badge } from '@/components/ui/misc';
import type { MovieNightSummary } from '@/lib/api/types';
import { MOVIE_NIGHT_STATUS_META } from '@/lib/constants';
import { formatDateTime, plural } from '@/lib/utils';

export function MovieNightCard({
  night,
  showGroup,
}: {
  night: MovieNightSummary;
  showGroup?: boolean;
}) {
  const status = MOVIE_NIGHT_STATUS_META[night.status];
  return (
    <Link
      href={`/movie-nights/${night.id}`}
      className="flex gap-4 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md"
    >
      {night.selectedMovie ? (
        <Poster
          src={night.selectedMovie.posterUrl}
          title={night.selectedMovie.title}
          className="w-16 shrink-0 rounded-lg"
        />
      ) : (
        <span className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Popcorn className="size-7" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={status.badge}>{status.label}</Badge>
          {showGroup ? (
            <span className="truncate text-xs text-muted-foreground">{night.group.name}</span>
          ) : null}
        </div>
        <p className="mt-1.5 truncate font-semibold">{night.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="size-3.5" aria-hidden />
          {night.scheduledAt ? formatDateTime(night.scheduledAt) : 'No date yet'}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" aria-hidden />
          {plural(night.participantCount, 'participant')}
          {night.status === 'planning' || night.status === 'voting'
            ? ` · ${plural(night.candidateCount, 'candidate')}`
            : ''}
        </p>
        {night.selectedMovie ? (
          <p className="mt-1 truncate text-sm">🎬 {night.selectedMovie.title}</p>
        ) : null}
      </div>
    </Link>
  );
}
