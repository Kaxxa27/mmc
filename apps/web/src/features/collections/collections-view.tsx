'use client';

import { Library, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Pagination } from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type CollectionScope, useCollections } from '@/lib/queries/collections';
import { CollectionCard } from './collection-card';
import { CollectionFormDialog } from './collection-form-dialog';

export const COLLECTION_GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';

export function CollectionGridSkeleton() {
  return (
    <div className={COLLECTION_GRID}>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-64 rounded-2xl" />
      ))}
    </div>
  );
}

export function CollectionsView() {
  const [scope, setScope] = useState<Exclude<CollectionScope, 'group'>>('mine');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const { data, isPending, error, refetch } = useCollections(scope, { page });

  return (
    <div>
      <PageHeader
        title="Collections"
        description="Curated lists of movies — keep them private, share them with people and groups, or publish them."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            New collection
          </Button>
        }
      />
      <Tabs
        value={scope}
        onValueChange={(value) => {
          setScope(value as typeof scope);
          setPage(1);
        }}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="mine">My collections</TabsTrigger>
          <TabsTrigger value="shared">Shared with me</TabsTrigger>
        </TabsList>
      </Tabs>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <CollectionGridSkeleton />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Library}
          title={scope === 'mine' ? 'No collections yet' : 'Nothing shared with you yet'}
          description={
            scope === 'mine'
              ? 'Create one for a theme, a holiday or a movie marathon. Group collections live on each group’s page.'
              : 'When someone shares a collection with you or your group, it shows up here.'
          }
          action={
            scope === 'mine' ? (
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                New collection
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className={COLLECTION_GRID}>
            {data.items.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                showOwner={scope === 'shared'}
              />
            ))}
          </div>
          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}
      {creating ? <CollectionFormDialog open onOpenChange={setCreating} /> : null}
    </div>
  );
}
