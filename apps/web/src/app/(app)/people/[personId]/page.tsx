import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { PersonView } from '@/features/person/person-view';
import { parsePositiveId } from '@/lib/route-params';

export default function PersonPage({ params }: PageProps<'/people/[personId]'>) {
  return (
    <Suspense fallback={<Spinner />}>
      {params.then(({ personId }) => (
        <PersonView personId={parsePositiveId(personId)} />
      ))}
    </Suspense>
  );
}
