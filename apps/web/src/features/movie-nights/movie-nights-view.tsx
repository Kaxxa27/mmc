'use client';

import { Plus, Popcorn } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState, ErrorState, PageHeader, Skeleton, Spinner } from '@/components/ui/misc';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupAvatar } from '@/features/groups/groups-view';
import { useGroup, useGroups } from '@/lib/queries/groups';
import { type MovieNightWhen, useAllMovieNights } from '@/lib/queries/movie-nights';
import { MovieNightCard } from './movie-night-card';
import { MovieNightFormDialog } from './movie-night-form-dialog';

function PlanForGroup({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const { data: group } = useGroup(groupId);
  if (!group) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent title="Plan a movie night">
          <Spinner />
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <MovieNightFormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      groupId={group.id}
      members={group.members}
    />
  );
}

export function MovieNightsView() {
  const [when, setWhen] = useState<MovieNightWhen>('upcoming');
  const [choosing, setChoosing] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const { data: groups, isPending: groupsPending, error: groupsError } = useGroups();
  const nights = useAllMovieNights(groups, when);
  const active = (groups ?? []).filter((group) => !group.archived);

  return (
    <div>
      <PageHeader
        title="Movie nights"
        description="Planned evenings across all your groups: candidates, votes, the decision and the verdict."
        actions={
          active.length > 0 ? (
            <Button
              onClick={() => (active.length === 1 ? setGroupId(active[0]!.id) : setChoosing(true))}
            >
              <Plus aria-hidden />
              Plan a movie night
            </Button>
          ) : null
        }
      />
      <Tabs
        value={when}
        onValueChange={(value) => setWhen(value as MovieNightWhen)}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {groupsError || nights.error ? (
        <ErrorState error={groupsError ?? nights.error} onRetry={nights.refetch} />
      ) : groupsPending || nights.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          icon={Popcorn}
          title="Movie nights happen in groups"
          description="Create a group for your family or friends first, then plan a movie night together."
          action={
            <Button asChild>
              <Link href="/groups">Go to groups</Link>
            </Button>
          }
        />
      ) : nights.items.length === 0 ? (
        <EmptyState
          icon={Popcorn}
          title={when === 'past' ? 'No past movie nights' : 'Nothing planned yet'}
          description="Plan one and let the group vote on what to watch."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {nights.items.map((night) => (
            <MovieNightCard key={night.id} night={night} showGroup />
          ))}
        </div>
      )}

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent title="Which group?" description="Movie nights belong to a group." size="sm">
          <ul className="flex flex-col gap-1">
            {active.map((group) => (
              <li key={group.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted"
                  onClick={() => {
                    setChoosing(false);
                    setGroupId(group.id);
                  }}
                >
                  <GroupAvatar group={group} size="md" />
                  <span className="font-medium">{group.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
      {groupId ? <PlanForGroup groupId={groupId} onClose={() => setGroupId(null)} /> : null}
    </div>
  );
}
