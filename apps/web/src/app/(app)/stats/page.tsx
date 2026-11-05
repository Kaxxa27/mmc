import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { StatsView } from '@/features/library/stats-view';

export const metadata: Metadata = { title: 'Stats' };

export default function StatsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <StatsView />
    </Suspense>
  );
}
