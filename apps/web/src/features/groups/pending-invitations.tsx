'use client';

import { Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/misc';
import { GROUP_ROLE_LABEL } from '@/lib/constants';
import { useMyInvitations, useRespondToInvitation } from '@/lib/queries/groups';
import { formatDate } from '@/lib/utils';

/** Invitations to groups waiting for an answer (shown on the home and groups pages). */
export function PendingInvitations({ id }: { id?: string }) {
  const { data: invitations } = useMyInvitations();
  const respond = useRespondToInvitation();
  const router = useRouter();
  if (!invitations || invitations.length === 0) return null;
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-2">
      {invitations.map((invitation) => {
        const busy = respond.isPending && respond.variables?.invitationId === invitation.id;
        return (
          <Card
            key={invitation.id}
            className="flex flex-col gap-3 border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center"
          >
            <Users className="size-5 shrink-0 text-primary" aria-hidden />
            <div className="flex-1 text-sm">
              <p>
                <span className="font-medium">
                  {invitation.invitedBy?.displayName ?? 'Someone'}
                </span>{' '}
                invited you to join <span className="font-medium">{invitation.group.name}</span> as{' '}
                {GROUP_ROLE_LABEL[invitation.role].toLowerCase()}.
              </p>
              <p className="text-xs text-muted-foreground">
                Expires {formatDate(invitation.expiresAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => respond.mutate({ invitationId: invitation.id, accept: false })}
              >
                Decline
              </Button>
              <Button
                size="sm"
                loading={busy && respond.variables?.accept}
                disabled={busy}
                onClick={() =>
                  respond.mutate(
                    { invitationId: invitation.id, accept: true },
                    { onSuccess: (result) => result && router.push(`/groups/${result.groupId}`) },
                  )
                }
              >
                Join group
              </Button>
            </div>
          </Card>
        );
      })}
    </section>
  );
}
