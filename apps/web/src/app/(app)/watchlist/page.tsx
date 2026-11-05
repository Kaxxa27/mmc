import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MovieGridSkeleton } from '@/components/movies/movie-grid';
import { WatchlistView } from '@/features/library/watchlist-view';

export const metadata: Metadata = { title: 'Watchlist' };

export default function WatchlistPage() {
  return (
    <Suspense fallback={<MovieGridSkeleton />}>
      <WatchlistView />
    </Suspense>
  );
}
