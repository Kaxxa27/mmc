import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MovieSummary } from '@/lib/api/types';
import { MovieCard } from './movie-card';
import { MovieCardSkeleton } from './movie-grid';

/** A titled, horizontally scrolling row of movies. */
export function MovieRow({
  title,
  subtitle,
  movies,
  href,
  loading,
  empty,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  movies: MovieSummary[] | undefined;
  href?: string;
  loading?: boolean;
  empty?: ReactNode;
}) {
  if (!loading && movies && movies.length === 0 && !empty) return null;
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
          {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {href ? (
          <Link
            href={href}
            className="flex shrink-0 items-center text-sm font-medium text-primary hover:underline"
          >
            See all
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      {loading || !movies ? (
        <div className="scrollbar-none -mx-4 flex gap-4 overflow-hidden px-4">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="w-36 shrink-0 sm:w-40">
              <MovieCardSkeleton />
            </div>
          ))}
        </div>
      ) : movies.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          {movies.map((movie, index) => (
            <MovieCard
              key={`${movie.tmdbId}-${index}`}
              movie={movie}
              className="w-36 shrink-0 snap-start sm:w-40"
            />
          ))}
        </div>
      )}
    </section>
  );
}
