'use client';

import { Library, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/misc';
import { CollectionCard } from '@/features/collections/collection-card';
import { CollectionFormDialog } from '@/features/collections/collection-form-dialog';
import { COLLECTION_GRID, CollectionGridSkeleton } from '@/features/collections/collections-view';
import type { GroupDetails } from '@/lib/api/types';
import { useCollections } from '@/lib/queries/collections';

export function GroupCollections({ group }: { group: GroupDetails }) {
  const { data, isPending, error, refetch } = useCollections('group', {
    groupId: group.id,
    pageSize: 100,
  });
  const [creating, setCreating] = useState(false);

  return (
    <div>
      {!group.archived ? (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            New group collection
          </Button>
        </div>
      ) : null}
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <CollectionGridSkeleton />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No group collections"
          description="Make themed lists together, like “Family Christmas” or “Summer marathon”."
        />
      ) : (
        <div className={COLLECTION_GRID}>
          {data.items.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} showOwner />
          ))}
        </div>
      )}
      {creating ? (
        <CollectionFormDialog open groupId={group.id} onOpenChange={setCreating} />
      ) : null}
    </div>
  );
}
