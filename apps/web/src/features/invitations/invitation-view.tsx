'use client';

import { LogIn, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, Spinner } from '@/components/ui/misc';
import { GroupAvatar } from '@/features/groups/groups-view';
import { ApiError, errorMessage } from '@/lib/api/client';
import { GROUP_KIND_LABEL, GROUP_ROLE_LABEL } from '@/lib/constants';
import { useMe } from '@/lib/queries/core';
import { useAcceptInvitationLink, useInvitationPreview } from '@/lib/queries/groups';
import { formatDate, plural } from '@/lib/utils';

const STATUS_TEXT: Record<string, string> = {
  accepted: 'This invitation was already accepted.',
  declined: 'This invitation was declined.',
  revoked: 'This invitation was withdrawn by the group.',
  expired: 'This invitation has expired. Ask for a new one.',
  exhausted: 'This invitation link has been used up. Ask for a new one.',
};

export function InvitationView({ token }: { token: string }) {
  const router = useRouter();
  const { data: me, isPending: mePending } = useMe();
  const { data: invitation, isPending, error } = useInvitationPreview(token);
  const accept = useAcceptInvitationLink();

  if (isPending) return <Spinner className="py-24" />;
  if (error) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">
          {missing ? 'Invitation not found' : 'Could not open the invitation'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {missing
            ? 'The link may be mistyped or the invitation was removed.'
            : errorMessage(error)}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/">Go home</Link>
        </Button>
      </Card>
    );
  }

  const { group } = invitation;
  const usable = invitation.status === 'pending';
  const next = `/invitations/${encodeURIComponent(token)}`;

  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <div className="flex justify-center">
        {group.avatarUrl ? (
          <GroupAvatar group={group} size="xl" />
        ) : (
          <span className="flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="size-9" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        {invitation.invitedBy
          ? `${invitation.invitedBy.displayName} invited you to join`
          : 'You are invited to join'}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{group.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {GROUP_KIND_LABEL[group.kind]} · {plural(group.memberCount, 'member')} · you join as{' '}
        {GROUP_ROLE_LABEL[invitation.role].toLowerCase()}
      </p>
      {invitation.emailHint ? (
        <p className="mt-1 text-xs text-muted-foreground">Sent to {invitation.emailHint}</p>
      ) : null}

      {usable ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Valid until {formatDate(invitation.expiresAt)}
          </p>
          {mePending ? (
            <Spinner className="py-6" />
          ) : me ? (
            <Button
              size="lg"
              className="mt-6 w-full"
              loading={accept.isPending}
              onClick={() =>
                accept.mutate(token, {
                  onSuccess: (result) => {
                    toast.success(
                      result.joined
                        ? `Welcome to ${group.name}!`
                        : `You are already in ${group.name}`,
                    );
                    router.replace(`/groups/${result.groupId}`);
                  },
                })
              }
            >
              Join {group.name}
            </Button>
          ) : (
            <Button asChild size="lg" className="mt-6 w-full">
              <Link href={`/sign-in?next=${encodeURIComponent(next)}`}>
                <LogIn aria-hidden />
                Sign in to join
              </Link>
            </Button>
          )}
          {accept.error instanceof ApiError && accept.error.code === 'INVITATION_EMAIL_MISMATCH' ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              This invitation was sent to {invitation.emailHint ?? 'another address'}. Sign in with
              that email to accept it.
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-6 rounded-xl bg-muted p-4 text-sm">
          {STATUS_TEXT[invitation.status] ?? 'This invitation can no longer be used.'}
        </p>
      )}
    </Card>
  );
}
