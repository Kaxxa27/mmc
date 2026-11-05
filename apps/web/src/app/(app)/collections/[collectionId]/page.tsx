import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { CollectionView } from '@/features/collections/collection-view';

export default function CollectionPage({ params }: PageProps<'/collections/[collectionId]'>) {
  return (
    <Suspense fallback={<Spinner />}>
      {params.then(({ collectionId }) => (
        <CollectionView collectionId={collectionId} />
      ))}
    </Suspense>
  );
}
