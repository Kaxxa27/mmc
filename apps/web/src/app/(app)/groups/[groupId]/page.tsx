import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { GroupView } from '@/features/groups/group-view';

export default function GroupPage({ params }: PageProps<'/groups/[groupId]'>) {
  return (
    <Suspense fallback={<Spinner />}>
      {params.then(({ groupId }) => (
        <GroupView groupId={groupId} />
      ))}
    </Suspense>
  );
}
