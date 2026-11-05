'use client';

import {
  Copy,
  Crown,
  Ellipsis,
  Link2,
  LogOut,
  Mail,
  Shield,
  ShieldOff,
  Trash2,
  UserMinus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Input, Select } from '@/components/ui/form';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { Avatar, Badge, Card, Spinner } from '@/components/ui/misc';
import type { CreatedLinkInvitation, GroupDetails, GroupRole, MemberView } from '@/lib/api/types';
import { GROUP_ROLE_LABEL } from '@/lib/constants';
import { useMe } from '@/lib/queries/core';
import {
  useChangeMemberRole,
  useCreateInvitationLink,
  useGroupInvitations,
  useInviteByEmail,
  useLeaveGroup,
  useRemoveMember,
  useRevokeInvitation,
  useTransferOwnership,
} from '@/lib/queries/groups';
import { formatDate } from '@/lib/utils';

const RANK: Record<GroupRole, number> = { owner: 3, admin: 2, member: 1 };

function RoleBadge({ role }: { role: GroupRole }) {
  if (role === 'member') return <Badge>Member</Badge>;
  return (
    <Badge
      className={
        role === 'owner'
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
      }
    >
      {role === 'owner' ? <Crown aria-hidden /> : <Shield aria-hidden />}
      {GROUP_ROLE_LABEL[role]}
    </Badge>
  );
}

type PendingAction = { kind: 'remove' | 'transfer'; member: MemberView } | { kind: 'leave' } | null;

function MembersList({ group }: { group: GroupDetails }) {
  const router = useRouter();
  const { data: me } = useMe();
  const changeRole = useChangeMemberRole(group.id);
  const remove = useRemoveMember(group.id);
  const transfer = useTransferOwnership(group.id);
  const leave = useLeaveGroup();
  const [pending, setPending] = useState<PendingAction>(null);
  const myRank = RANK[group.myRole];

  return (
    <Card>
      <ul className="divide-y">
        {group.members.map((member) => {
          const isMe = member.id === me?.id;
          const canChangeRole = group.myRole === 'owner' && !isMe && member.role !== 'owner';
          const canRemove = !isMe && myRank >= 2 && RANK[member.role] < myRank;
          const hasActions = !group.archived && (canChangeRole || canRemove || isMe);
          return (
            <li key={member.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={member.displayName} src={member.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.displayName}{' '}
                  {isMe ? <span className="text-muted-foreground">(you)</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.username ? `@${member.username} · ` : ''}joined{' '}
                  {formatDate(member.joinedAt)}
                </p>
              </div>
              <RoleBadge role={member.role} />
              {hasActions ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${member.displayName}`}
                    >
                      <Ellipsis aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {canChangeRole ? (
                      <>
                        {member.role === 'member' ? (
                          <DropdownMenuItem
                            onSelect={() => changeRole.mutate({ userId: member.id, role: 'admin' })}
                          >
                            <Shield aria-hidden />
                            Make admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() =>
                              changeRole.mutate({ userId: member.id, role: 'member' })
                            }
                          >
                            <ShieldOff aria-hidden />
                            Make member
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setPending({ kind: 'transfer', member })}>
                          <Crown aria-hidden />
                          Transfer ownership
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    {canRemove ? (
                      <>
                        {canChangeRole ? <DropdownMenuSeparator /> : null}
                        <DropdownMenuItem
                          destructive
                          onSelect={() => setPending({ kind: 'remove', member })}
                        >
                          <UserMinus aria-hidden />
                          Remove from group
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    {isMe ? (
                      <DropdownMenuItem
                        destructive
                        disabled={group.myRole === 'owner'}
                        onSelect={() => setPending({ kind: 'leave' })}
                      >
                        <LogOut aria-hidden />
                        {group.myRole === 'owner' ? 'Transfer ownership to leave' : 'Leave group'}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.kind === 'remove'
            ? `Remove ${pending.member.displayName}?`
            : pending?.kind === 'transfer'
              ? `Make ${pending.member.displayName} the owner?`
              : `Leave ${group.name}?`
        }
        description={
          pending?.kind === 'remove'
            ? 'They lose access to the group catalog, collections and movie nights.'
            : pending?.kind === 'transfer'
              ? 'You become an admin. Only the new owner can undo this.'
              : 'You lose access to the group until someone invites you again.'
        }
        confirmLabel={
          pending?.kind === 'transfer'
            ? 'Transfer'
            : pending?.kind === 'remove'
              ? 'Remove'
              : 'Leave'
        }
        destructive={pending?.kind !== 'transfer'}
        loading={remove.isPending || transfer.isPending || leave.isPending}
        onConfirm={() => {
          if (!pending) return;
          const done = { onSuccess: () => setPending(null) };
          if (pending.kind === 'remove') remove.mutate(pending.member.id, done);
          else if (pending.kind === 'transfer') transfer.mutate(pending.member.id, done);
          else leave.mutate(group.id, { onSuccess: () => router.replace('/groups') });
        }}
      />
    </Card>
  );
}

function InviteForms({ group }: { group: GroupDetails }) {
  const inviteEmail = useInviteByEmail(group.id);
  const createLink = useCreateInvitationLink(group.id);
  const [email, setEmail] = useState('');
  const [emailRole, setEmailRole] = useState<'member' | 'admin'>('member');
  const [linkRole, setLinkRole] = useState<'member' | 'admin'>('member');
  const [expires, setExpires] = useState('7');
  const [maxUses, setMaxUses] = useState('');
  const [created, setCreated] = useState<CreatedLinkInvitation | null>(null);
  const isOwner = group.myRole === 'owner';

  function sendEmail(event: FormEvent) {
    event.preventDefault();
    inviteEmail.mutate({ email: email.trim(), role: emailRole }, { onSuccess: () => setEmail('') });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <p className="flex items-center gap-2 font-semibold">
          <Mail className="size-4" aria-hidden />
          Invite by email
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          They get an email; people who already have an account also see it in the app.
        </p>
        <form onSubmit={sendEmail} className="mt-4 flex flex-col gap-3">
          <Input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ben@example.com"
            aria-label="Email"
          />
          <div className="flex gap-2">
            {isOwner ? (
              <Select
                value={emailRole}
                onChange={(event) => setEmailRole(event.target.value as 'member' | 'admin')}
                aria-label="Role"
                className="w-36"
              >
                <option value="member">As member</option>
                <option value="admin">As admin</option>
              </Select>
            ) : null}
            <Button
              type="submit"
              className="flex-1"
              loading={inviteEmail.isPending}
              disabled={!email.trim()}
            >
              Send invitation
            </Button>
          </div>
        </form>
      </Card>
      <Card className="p-4">
        <p className="flex items-center gap-2 font-semibold">
          <Link2 className="size-4" aria-hidden />
          Invite with a link
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Anyone with the link can join until it expires or runs out of uses.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Field label="Expires" htmlFor="link-expires">
            <Select
              id="link-expires"
              value={expires}
              onChange={(event) => setExpires(event.target.value)}
            >
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
            </Select>
          </Field>
          <Field label="Uses" htmlFor="link-uses">
            <Select
              id="link-uses"
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
            >
              <option value="">Unlimited</option>
              <option value="1">1</option>
              <option value="5">5</option>
              <option value="10">10</option>
            </Select>
          </Field>
          <Field label="Role" htmlFor="link-role">
            <Select
              id="link-role"
              value={linkRole}
              disabled={!isOwner}
              onChange={(event) => setLinkRole(event.target.value as 'member' | 'admin')}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        </div>
        <Button
          variant="secondary"
          className="mt-3 w-full"
          loading={createLink.isPending}
          onClick={() =>
            createLink.mutate(
              {
                role: linkRole,
                expiresInDays: Number(expires),
                ...(maxUses ? { maxUses: Number(maxUses) } : {}),
              },
              { onSuccess: setCreated },
            )
          }
        >
          Create link
        </Button>
        {created ? (
          <div className="mt-3 rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              Copy it now — the link is shown only once.
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                readOnly
                value={created.url}
                onFocus={(event) => event.target.select()}
                aria-label="Invitation link"
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy link"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(created.url)
                    .then(() => toast.success('Link copied'))
                }
              >
                <Copy aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function InvitationList({ group }: { group: GroupDetails }) {
  const { data: invitations, isPending } = useGroupInvitations(group.id, true);
  const revoke = useRevokeInvitation(group.id);
  const pending = (invitations ?? []).filter((invitation) => invitation.status === 'pending');
  if (isPending) return <Spinner className="py-6" />;
  if (pending.length === 0)
    return <p className="text-sm text-muted-foreground">No pending invitations.</p>;
  return (
    <Card>
      <ul className="divide-y">
        {pending.map((invitation) => (
          <li key={invitation.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            {invitation.kind === 'email' ? (
              <Mail className="size-4 text-muted-foreground" aria-hidden />
            ) : (
              <Link2 className="size-4 text-muted-foreground" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {invitation.kind === 'email' ? invitation.email : 'Invitation link'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {GROUP_ROLE_LABEL[invitation.role]} · expires {formatDate(invitation.expiresAt)}
                {invitation.kind === 'link'
                  ? ` · used ${invitation.useCount}${invitation.maxUses ? `/${invitation.maxUses}` : ''}`
                  : ''}
                {invitation.invitedBy ? ` · by ${invitation.invitedBy.displayName}` : ''}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              loading={revoke.isPending && revoke.variables === invitation.id}
              onClick={() => revoke.mutate(invitation.id)}
            >
              <Trash2 aria-hidden />
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function GroupMembers({ group }: { group: GroupDetails }) {
  const canInvite = RANK[group.myRole] >= 2 && !group.archived;
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 font-semibold">Members ({group.members.length})</h2>
        <MembersList group={group} />
      </section>
      {canInvite ? (
        <>
          <section>
            <h2 className="mb-3 font-semibold">Invite people</h2>
            <InviteForms group={group} />
          </section>
          <section>
            <h2 className="mb-3 font-semibold">Pending invitations</h2>
            <InvitationList group={group} />
          </section>
        </>
      ) : null}
    </div>
  );
}
