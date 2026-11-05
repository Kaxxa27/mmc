'use client';

import { Archive, CalendarDays, Film, Library, Popcorn, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { CalendarMonth } from '@/components/calendar/calendar-month';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupMovieNights } from '@/features/movie-nights/group-movie-nights';
import { useUrlState } from '@/hooks/use-url-state';
import { ApiError } from '@/lib/api/client';
import { GROUP_KIND_LABEL, GROUP_ROLE_LABEL } from '@/lib/constants';
import { useArchiveGroup, useGroup } from '@/lib/queries/groups';
import { plural } from '@/lib/utils';
import { GroupCatalog } from './group-catalog';
import { GroupCollections } from './group-collections';
import { GroupMembers } from './group-members';
import { GroupSettings } from './group-settings';
import { GroupAvatar } from './groups-view';

const TABS = ['catalog', 'movie-nights', 'members', 'collections', 'calendar', 'settings'] as const;
type Tab = (typeof TABS)[number];

export function GroupView({ groupId }: { groupId: string }) {
  const url = useUrlState();
  const { data: group, isPending, error, refetch } = useGroup(groupId);
  const restore = useArchiveGroup(groupId);

  if (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return (
        <EmptyState
          icon={Users}
          title="Group not found"
          description="It may have been deleted, or you are not a member."
          action={
            <Button asChild variant="outline">
              <Link href="/groups">Back to groups</Link>
            </Button>
          }
        />
      );
    }
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }
  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const isAdmin = group.myRole !== 'member';
  const available = TABS.filter((tab) => tab !== 'settings' || isAdmin);
  const requested = url.get('tab') as Tab | undefined;
  const tab: Tab = requested && available.includes(requested) ? requested : 'catalog';

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <GroupAvatar group={group} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{group.name}</h1>
            <Badge>{GROUP_KIND_LABEL[group.kind]}</Badge>
            <Badge>{GROUP_ROLE_LABEL[group.myRole]}</Badge>
          </div>
          {group.description ? (
            <p className="mt-1 text-muted-foreground">{group.description}</p>
          ) : null}
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex -space-x-2">
              {group.members.slice(0, 6).map((member) => (
                <Avatar
                  key={member.id}
                  name={member.displayName}
                  src={member.avatarUrl}
                  size="xs"
                  className="ring-2 ring-background"
                />
              ))}
            </span>
            {plural(group.memberCount, 'member')} · {plural(group.movieCount, 'movie')}
          </div>
        </div>
      </div>

      {group.archived ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2">
            <Archive className="size-4" aria-hidden />
            This group is archived — everything is read-only.
          </p>
          {group.myRole === 'owner' ? (
            <Button
              size="sm"
              variant="outline"
              loading={restore.isPending}
              onClick={() => restore.mutate(false)}
            >
              Restore group
            </Button>
          ) : null}
        </div>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(value) => url.set({ tab: value === 'catalog' ? null : value })}
      >
        <TabsList className="mb-6">
          <TabsTrigger value="catalog">
            <Film aria-hidden />
            Catalog
          </TabsTrigger>
          <TabsTrigger value="movie-nights">
            <Popcorn aria-hidden />
            Movie nights
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users aria-hidden />
            Members
          </TabsTrigger>
          <TabsTrigger value="collections">
            <Library aria-hidden />
            Collections
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays aria-hidden />
            Calendar
          </TabsTrigger>
          {isAdmin ? (
            <TabsTrigger value="settings">
              <Settings aria-hidden />
              Settings
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="catalog">
          <GroupCatalog group={group} />
        </TabsContent>
        <TabsContent value="movie-nights">
          <GroupMovieNights group={group} />
        </TabsContent>
        <TabsContent value="members">
          <GroupMembers group={group} />
        </TabsContent>
        <TabsContent value="collections">
          <GroupCollections group={group} />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarMonth groupId={group.id} />
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="settings">
            <GroupSettings key={group.updatedAt} group={group} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
