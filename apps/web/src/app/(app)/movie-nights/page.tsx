import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { MovieNightsView } from '@/features/movie-nights/movie-nights-view';

export const metadata: Metadata = { title: 'Movie nights' };

export default function MovieNightsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <MovieNightsView />
    </Suspense>
  );
}
