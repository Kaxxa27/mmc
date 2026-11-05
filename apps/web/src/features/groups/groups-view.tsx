'use client';

import { Archive, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/form';
import { Avatar, Badge, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc';
import type { GroupSummary } from '@/lib/api/types';
import { GROUP_KIND_LABEL, GROUP_ROLE_LABEL } from '@/lib/constants';
import { useGroups } from '@/lib/queries/groups';
import { plural } from '@/lib/utils';
import { CreateGroupDialog } from './group-form-dialog';
import { PendingInvitations } from './pending-invitations';

export function GroupAvatar({
  group,
  size = 'lg',
}: {
  group: Pick<GroupSummary, 'name' | 'avatarUrl'>;
  size?: 'md' | 'lg' | 'xl';
}) {
  return <Avatar name={group.name} src={group.avatarUrl} size={size} className="rounded-2xl" />;
}

function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className="flex gap-4 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <GroupAvatar group={group} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold">{group.name}</p>
          {group.archived ? (
            <Badge>
              <Archive aria-hidden />
              Archived
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {GROUP_KIND_LABEL[group.kind]} · {GROUP_ROLE_LABEL[group.myRole]}
        </p>
        {group.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{group.description}</p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          {plural(group.memberCount, 'member')} · {plural(group.movieCount, 'movie')}
        </p>
      </div>
    </Link>
  );
}

export function GroupsView() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data: groups, isPending, error, refetch } = useGroups(includeArchived);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title="Groups"
        description="Family and friends: a shared movie list, ratings, comments and movie nights."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            New group
          </Button>
        }
      />
      <PendingInvitations id="invitations" />
      <Checkbox
        label="Show archived groups"
        checked={includeArchived}
        onChange={(event) => setIncludeArchived(event.target.checked)}
      />
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description="Create a group for your family or friends, then invite them by email or with a link."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              Create a group
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
      {creating ? <CreateGroupDialog open onOpenChange={setCreating} /> : null}
    </div>
  );
}
