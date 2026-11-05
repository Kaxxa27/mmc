import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MovieGridSkeleton } from '@/components/movies/movie-grid';
import { SearchView } from '@/features/search/search-view';

export const metadata: Metadata = { title: 'Search' };

export default function SearchPage() {
  return (
    <Suspense fallback={<MovieGridSkeleton count={12} />}>
      <SearchView />
    </Suspense>
  );
}
