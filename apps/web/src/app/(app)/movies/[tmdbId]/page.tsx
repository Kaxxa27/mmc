import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { MovieView } from '@/features/movie/movie-view';
import { parsePositiveId } from '@/lib/route-params';

export default function MoviePage({ params }: PageProps<'/movies/[tmdbId]'>) {
  return (
    <Suspense fallback={<Spinner />}>
      {params.then(({ tmdbId }) => (
        <MovieView tmdbId={parsePositiveId(tmdbId)} />
      ))}
    </Suspense>
  );
}
