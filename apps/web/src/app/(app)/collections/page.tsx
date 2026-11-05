import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CollectionGridSkeleton, CollectionsView } from '@/features/collections/collections-view';

export const metadata: Metadata = { title: 'Collections' };

export default function CollectionsPage() {
  return (
    <Suspense fallback={<CollectionGridSkeleton />}>
      <CollectionsView />
    </Suspense>
  );
}
