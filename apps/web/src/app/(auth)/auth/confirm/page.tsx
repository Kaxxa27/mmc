import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { ConfirmView } from '@/features/auth/confirm-view';

export const metadata: Metadata = { title: 'Finish signing in' };

export default function ConfirmPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ConfirmView />
    </Suspense>
  );
}
