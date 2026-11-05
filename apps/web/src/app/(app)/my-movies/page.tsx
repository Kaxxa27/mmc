import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MovieGridSkeleton } from '@/components/movies/movie-grid';
import { MyMoviesView } from '@/features/library/my-movies-view';

export const metadata: Metadata = { title: 'My movies' };

export default function MyMoviesPage() {
  return (
    <Suspense fallback={<MovieGridSkeleton />}>
      <MyMoviesView />
    </Suspense>
  );
}
