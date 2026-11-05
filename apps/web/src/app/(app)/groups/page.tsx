import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { GroupsView } from '@/features/groups/groups-view';

export const metadata: Metadata = { title: 'Groups' };

export default function GroupsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <GroupsView />
    </Suspense>
  );
}
