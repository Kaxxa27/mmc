import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { NotificationsView } from '@/features/notifications/notifications-view';

export const metadata: Metadata = { title: 'Notifications' };

export default function NotificationsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NotificationsView />
    </Suspense>
  );
}
