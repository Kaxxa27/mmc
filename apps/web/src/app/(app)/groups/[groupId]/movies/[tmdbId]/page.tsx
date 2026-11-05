import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { GroupMovieView } from '@/features/groups/group-movie-view';
import { parsePositiveId } from '@/lib/route-params';

export default function GroupMoviePage({ params }: PageProps<'/groups/[groupId]/movies/[tmdbId]'>) {
  return (
    <Suspense fallback={<Spinner />}>
      {params.then(({ groupId, tmdbId }) => (
        <GroupMovieView groupId={groupId} tmdbId={parsePositiveId(tmdbId)} />
      ))}
    </Suspense>
  );
}
