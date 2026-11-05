import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { HistoryView } from '@/features/library/history-view';

export const metadata: Metadata = { title: 'History' };

export default function HistoryPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <HistoryView />
    </Suspense>
  );
}
