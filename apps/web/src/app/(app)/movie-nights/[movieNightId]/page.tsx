import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { MovieNightView } from '@/features/movie-nights/movie-night-view';

export default function MovieNightPage({ params }: PageProps<'/movie-nights/[movieNightId]'>) {
  return (
    <Suspense fallback={<Spinner />}>
      {params.then(({ movieNightId }) => (
        <MovieNightView movieNightId={movieNightId} />
      ))}
    </Suspense>
  );
}
