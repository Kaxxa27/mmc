import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { ReviewsView } from '@/features/library/reviews-view';

export const metadata: Metadata = { title: 'My reviews' };

export default function ReviewsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ReviewsView />
    </Suspense>
  );
}
