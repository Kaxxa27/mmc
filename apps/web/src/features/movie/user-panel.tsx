'use client';

import {
  Ellipsis,
  EyeOff,
  FolderPlus,
  Heart,
  NotebookPen,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { type MovieDialog, MovieDialogs } from '@/components/movies/movie-actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { StarRating } from '@/components/ui/misc';
import type { MovieDetails, MovieStatus } from '@/lib/api/types';
import { MOVIE_STATUS_META } from '@/lib/constants';
import {
  useLibraryEntry,
  useRemoveLibraryEntry,
  useUpdateLibraryEntry,
} from '@/lib/queries/library';
import { cn, formatDate, plural } from '@/lib/utils';

const PRIMARY_STATUSES: MovieStatus[] = ['want_to_watch', 'watching', 'watched'];

/** Your relationship with the movie: status, favorite, rating, notes, viewings. */
export function UserPanel({
  movie,
  onWriteReview,
}: {
  movie: MovieDetails;
  onWriteReview: () => void;
}) {
  const { data: entry } = useLibraryEntry(movie.tmdbId, Boolean(movie.userState));
  const update = useUpdateLibraryEntry((saved) =>
    saved.status ? `Marked as “${MOVIE_STATUS_META[saved.status].label}”` : 'Saved',
  );
  const remove = useRemoveLibraryEntry();
  const [dialog, setDialog] = useState<MovieDialog>(null);

  const status = entry?.status ?? movie.userState?.status ?? null;
  const isFavorite = entry?.isFavorite ?? movie.userState?.isFavorite ?? false;
  const rating = entry?.rating ?? movie.userState?.rating ?? null;
  const ref = { tmdbId: movie.tmdbId, title: movie.title, userState: movie.userState };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRIMARY_STATUSES.map((value) => {
          const meta = MOVIE_STATUS_META[value];
          const Icon = meta.icon;
          const active = status === value;
          return (
            <Button
              key={value}
              variant={active ? 'primary' : 'outline'}
              aria-pressed={active}
              disabled={update.isPending}
              onClick={() => update.mutate({ tmdbId: movie.tmdbId, status: active ? null : value })}
            >
              <Icon aria-hidden />
              {meta.label}
            </Button>
          );
        })}
        <Button
          variant="outline"
          size="icon"
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={() => update.mutate({ tmdbId: movie.tmdbId, isFavorite: !isFavorite })}
        >
          <Heart className={cn(isFavorite && 'fill-rose-500 text-rose-500')} aria-hidden />
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More actions">
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuItem
              onSelect={() =>
                update.mutate({
                  tmdbId: movie.tmdbId,
                  status: status === 'not_interested' ? null : 'not_interested',
                })
              }
            >
              <EyeOff aria-hidden />
              {status === 'not_interested' ? 'Interested after all' : 'Not interested'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog('collection')}>
              <FolderPlus aria-hidden />
              Add to collection…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog('group')}>
              <Users aria-hidden />
              Add to group catalog…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onWriteReview}>
              <NotebookPen aria-hidden />
              Write a review…
            </DropdownMenuItem>
            {entry ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  destructive
                  onSelect={() => remove.mutate({ tmdbId: movie.tmdbId })}
                >
                  <Trash2 aria-hidden />
                  Remove from my catalog
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your rating
        </p>
        <StarRating
          value={rating}
          onChange={(value) => update.mutate({ tmdbId: movie.tmdbId, rating: value })}
        />
      </div>

      {entry && (entry.watchCount > 0 || entry.notes) ? (
        <div className="rounded-xl bg-muted/60 p-3 text-sm">
          {entry.watchCount > 0 ? (
            <p>
              Watched {plural(entry.watchCount, 'time')}
              {entry.lastWatchedOn ? ` · last on ${formatDate(entry.lastWatchedOn)}` : ''}
            </p>
          ) : null}
          {entry.notes ? (
            <p className="mt-1 whitespace-pre-line text-muted-foreground">📝 {entry.notes}</p>
          ) : null}
        </div>
      ) : null}

      <div>
        <Button variant="link" size="sm" onClick={() => setDialog('entry')}>
          <Pencil aria-hidden />
          Notes, viewing date & details
        </Button>
      </div>

      <MovieDialogs movie={ref} open={dialog} onOpenChange={setDialog} />
    </div>
  );
}
