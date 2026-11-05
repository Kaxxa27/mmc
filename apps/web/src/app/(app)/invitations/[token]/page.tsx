import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { InvitationView } from '@/features/invitations/invitation-view';

export const metadata: Metadata = { title: 'Group invitation' };

export default function InvitationPage({ params }: PageProps<'/invitations/[token]'>) {
  return (
    <Suspense fallback={<Spinner />}>
      {params.then(({ token }) => (
        <InvitationView token={token} />
      ))}
    </Suspense>
  );
}
