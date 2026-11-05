import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/misc';
import type { MovieSummary } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { MovieCard } from './movie-card';

export const GRID_CLASS =
  'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6';

export function MovieGrid({
  movies,
  footer,
  className,
}: {
  movies: MovieSummary[];
  footer?: (movie: MovieSummary) => ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(GRID_CLASS, className)}>
      {movies.map((movie, index) => (
        <MovieCard key={movie.tmdbId} movie={movie} footer={footer?.(movie)} priority={index < 6} />
      ))}
    </div>
  );
}

export function MovieCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[2/3] rounded-xl" />
      <Skeleton className="mt-2 h-4 w-4/5" />
      <Skeleton className="mt-1.5 h-3 w-1/3" />
    </div>
  );
}

export function MovieGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: count }, (_, index) => (
        <MovieCardSkeleton key={index} />
      ))}
    </div>
  );
}
