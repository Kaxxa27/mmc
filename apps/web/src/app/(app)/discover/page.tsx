import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MovieGridSkeleton } from '@/components/movies/movie-grid';
import { DiscoverView } from '@/features/discover/discover-view';

export const metadata: Metadata = { title: 'Discover' };

export default function DiscoverPage() {
  return (
    <Suspense fallback={<MovieGridSkeleton count={18} />}>
      <DiscoverView />
    </Suspense>
  );
}
