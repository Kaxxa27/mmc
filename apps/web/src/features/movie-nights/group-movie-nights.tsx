'use client';

import { Plus, Popcorn } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { GroupDetails } from '@/lib/api/types';
import { type MovieNightWhen, useGroupMovieNights } from '@/lib/queries/movie-nights';
import { MovieNightCard } from './movie-night-card';
import { MovieNightFormDialog } from './movie-night-form-dialog';

export function GroupMovieNights({ group }: { group: GroupDetails }) {
  const [when, setWhen] = useState<MovieNightWhen>('upcoming');
  const [creating, setCreating] = useState(false);
  const { data, isPending, error, refetch } = useGroupMovieNights(group.id, { when });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={when} onValueChange={(value) => setWhen(value as MovieNightWhen)}>
          <TabsList className="border-b-0">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        {!group.archived ? (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Plan a movie night
          </Button>
        ) : null}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Popcorn}
          title={when === 'past' ? 'No past movie nights' : 'No movie nights planned'}
          description="Plan one: pick a date, collect candidates, vote, and watch together."
          action={
            !group.archived ? (
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                Plan a movie night
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.items.map((night) => (
            <MovieNightCard key={night.id} night={night} />
          ))}
        </div>
      )}
      {creating ? (
        <MovieNightFormDialog
          open
          onOpenChange={setCreating}
          groupId={group.id}
          members={group.members}
        />
      ) : null}
    </div>
  );
}
