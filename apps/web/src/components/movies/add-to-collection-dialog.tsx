'use client';

import { Check, Library, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/form';
import { Spinner } from '@/components/ui/misc';
import type { CollectionSummary, MovieSummary } from '@/lib/api/types';
import { useAddToCollection, useCollections, useCreateCollection } from '@/lib/queries/collections';
import { useGroups } from '@/lib/queries/groups';
import { plural } from '@/lib/utils';

type MovieRef = Pick<MovieSummary, 'tmdbId' | 'title'>;

function CollectionList({
  collections,
  movie,
  emptyText,
}: {
  collections: CollectionSummary[] | undefined;
  movie: MovieRef;
  emptyText: string;
}) {
  const add = useAddToCollection();
  const [added, setAdded] = useState<string[]>([]);
  const editable = (collections ?? []).filter((collection) => collection.permissions.canEdit);
  if (!collections) return <Spinner className="py-6" />;
  if (editable.length === 0)
    return <p className="py-4 text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {editable.map((collection) => {
        const done = added.includes(collection.id);
        return (
          <li
            key={collection.id}
            className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Library className="size-4 text-muted-foreground" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{collection.name}</span>
              <span className="text-xs text-muted-foreground">
                {plural(collection.itemCount, 'movie')}
              </span>
            </span>
            <Button
              size="sm"
              variant={done ? 'secondary' : 'outline'}
              disabled={done}
              loading={add.isPending && add.variables?.collectionId === collection.id}
              onClick={() =>
                add.mutate(
                  { collectionId: collection.id, tmdbId: movie.tmdbId },
                  { onSuccess: () => setAdded((ids) => [...ids, collection.id]) },
                )
              }
            >
              {done ? <Check aria-hidden /> : <Plus aria-hidden />}
              {done ? 'Added' : 'Add'}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function GroupCollections({ movie }: { movie: MovieRef }) {
  const { data: groups } = useGroups();
  const active = (groups ?? []).filter((group) => !group.archived);
  const [groupId, setGroupId] = useState('');
  const selected = groupId || active[0]?.id || '';
  const { data } = useCollections('group', { groupId: selected, pageSize: 100 });
  if (!groups || active.length === 0) return null;
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Group collections</h3>
        <Select
          value={selected}
          onChange={(event) => setGroupId(event.target.value)}
          className="h-8 w-44 text-xs"
          aria-label="Group"
        >
          {active.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
      </div>
      <CollectionList
        collections={data?.items}
        movie={movie}
        emptyText="This group has no collections yet."
      />
    </section>
  );
}

export function AddToCollectionDialog({
  movie,
  open,
  onOpenChange,
}: {
  movie: MovieRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useCollections('mine', { pageSize: 100 });
  const create = useCreateCollection();
  const add = useAddToCollection();
  const [name, setName] = useState('');

  function createAndAdd(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(
      { name: trimmed },
      {
        onSuccess: (collection) => {
          setName('');
          add.mutate({ collectionId: collection.id, tmdbId: movie.tmdbId });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add to collection" description={movie.title}>
        <section>
          <h3 className="mb-2 text-sm font-semibold">My collections</h3>
          <CollectionList
            collections={data?.items}
            movie={movie}
            emptyText="You have no collections yet — create one below."
          />
        </section>
        <form onSubmit={createAndAdd} className="mt-4 flex gap-2">
          <Input
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            placeholder="New collection, e.g. “Christmas movies”"
            aria-label="New collection name"
          />
          <Button
            type="submit"
            variant="secondary"
            loading={create.isPending}
            disabled={!name.trim()}
          >
            Create & add
          </Button>
        </form>
        <GroupCollections movie={movie} />
      </DialogContent>
    </Dialog>
  );
}
