'use client';

import { Ellipsis, Star } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MovieSummary } from '@/lib/api/types';
import { MOVIE_STATUS_META } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { MovieActionsMenu } from './movie-actions';
import { Poster } from './poster';
import { FavoriteMark, TmdbRating } from './status-badge';

export function MovieCard({
  movie,
  footer,
  priority,
  className,
}: {
  movie: MovieSummary;
  /** Extra line under the title (e.g. "watched on …", group rating). */
  footer?: ReactNode;
  priority?: boolean;
  className?: string;
}) {
  const state = movie.userState;
  const status = state?.status ? MOVIE_STATUS_META[state.status] : null;
  const StatusIcon = status?.icon;

  return (
    <div className={cn('group relative flex min-w-0 flex-col', className)}>
      <Link
        href={`/movies/${movie.tmdbId}`}
        className="relative block rounded-xl focus-visible:outline-offset-4"
      >
        <Poster
          src={movie.posterUrl}
          title={movie.title}
          priority={priority}
          className="shadow-sm ring-1 ring-black/5 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg dark:ring-white/10"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 rounded-b-xl bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
          {status && StatusIcon ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
              <span className={cn('size-1.5 rounded-full', status.dot)} aria-hidden />
              {status.label}
            </span>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1.5">
            {state?.rating ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white"
                title="Your rating"
              >
                <Star className="size-3 fill-white" aria-hidden />
                {state.rating}
              </span>
            ) : null}
            {state?.isFavorite ? <FavoriteMark className="drop-shadow" /> : null}
          </span>
        </div>
      </Link>
      <MovieActionsMenu
        movie={movie}
        trigger={
          <button
            type="button"
            aria-label={`Actions for ${movie.title}`}
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/55 text-white opacity-100 backdrop-blur-sm transition hover:bg-black/75 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <Ellipsis className="size-4" aria-hidden />
          </button>
        }
      />
      <div className="mt-2 min-w-0 px-0.5">
        <Link
          href={`/movies/${movie.tmdbId}`}
          className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
        >
          {movie.title}
        </Link>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {movie.releaseYear ? <span>{movie.releaseYear}</span> : null}
          <TmdbRating value={movie.voteAverage} />
        </div>
        {footer ? <div className="mt-1 text-xs text-muted-foreground">{footer}</div> : null}
      </div>
    </div>
  );
}
