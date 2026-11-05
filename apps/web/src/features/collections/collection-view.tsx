'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Ellipsis,
  ImagePlus,
  Link2,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { GRID_CLASS } from '@/components/movies/movie-grid';
import { MovieCard } from '@/components/movies/movie-card';
import { MoviePickerDialog } from '@/components/movies/movie-picker-dialog';
import { Poster } from '@/components/movies/poster';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { Avatar, Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { ApiError } from '@/lib/api/client';
import type { CollectionDetails, CollectionItemView } from '@/lib/api/types';
import {
  useAddToCollection,
  useCollection,
  useDeleteCollection,
  useRemoveFromCollection,
  useReorderCollection,
  useUploadCollectionCover,
} from '@/lib/queries/collections';
import { plural } from '@/lib/utils';
import { VisibilityBadge } from './collection-card';
import { CollectionFormDialog } from './collection-form-dialog';
import { ShareDialog } from './share-dialog';

function ReorderList({
  collection,
  onDone,
}: {
  collection: CollectionDetails;
  onDone: () => void;
}) {
  const [order, setOrder] = useState<CollectionItemView[]>(collection.items);
  const reorder = useReorderCollection(collection.id);

  function move(index: number, delta: number) {
    setOrder((items) => {
      const next = [...items];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item!);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-4 py-3 text-sm">
        <span>Move movies up or down, then save the new order.</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDone}>
            <X aria-hidden />
            Cancel
          </Button>
          <Button
            size="sm"
            loading={reorder.isPending}
            onClick={() =>
              reorder.mutate(
                order.map((item) => item.movie.tmdbId),
                { onSuccess: onDone },
              )
            }
          >
            <Check aria-hidden />
            Save order
          </Button>
        </div>
      </div>
      <ol className="divide-y rounded-2xl border bg-card">
        {order.map((item, index) => (
          <li key={item.movie.tmdbId} className="flex items-center gap-3 px-3 py-2">
            <span className="w-6 text-right text-sm tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <Poster
              src={item.movie.posterUrl}
              title={item.movie.title}
              className="w-10 rounded-md"
            />
            <span className="flex-1 truncate text-sm font-medium">{item.movie.title}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move up"
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move down"
              disabled={index === order.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown aria-hidden />
            </Button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CollectionView({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const { data: collection, isPending, error, refetch } = useCollection(collectionId);
  const add = useAddToCollection();
  const remove = useRemoveFromCollection(collectionId);
  const deleteCollection = useDeleteCollection();
  const upload = useUploadCollectionCover(collectionId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<'edit' | 'share' | 'add' | 'delete' | null>(null);
  const [reordering, setReordering] = useState(false);

  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          icon={X}
          title="Collection not found"
          description="It may be private, or it was deleted. Ask the owner to share it with you."
          action={
            <Button asChild variant="outline">
              <Link href="/collections">Back to collections</Link>
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
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const { permissions } = collection;

  return (
    <div>
      <div className="relative mb-8 overflow-hidden rounded-3xl border bg-card">
        {collection.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded cover from Supabase Storage
          <img
            src={collection.coverImageUrl}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-25"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/15 via-orange-400/10 to-sky-500/15" />
        )}
        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <VisibilityBadge visibility={collection.visibility} />
              {collection.group ? (
                <Link href={`/groups/${collection.group.id}`}>
                  <Badge className="hover:bg-muted/70">{collection.group.name}</Badge>
                </Link>
              ) : null}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{collection.name}</h1>
            {collection.description ? (
              <p className="mt-2 max-w-2xl text-muted-foreground">{collection.description}</p>
            ) : null}
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar
                name={collection.owner.displayName}
                src={collection.owner.avatarUrl}
                size="xs"
              />
              {collection.owner.displayName} · {plural(collection.itemCount, 'movie')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {permissions.canEdit ? (
              <Button onClick={() => setDialog('add')}>
                <Plus aria-hidden />
                Add movies
              </Button>
            ) : null}
            {collection.visibility === 'public' ? (
              <Button
                variant="outline"
                onClick={() => {
                  const url = `${window.location.origin}/collections/${collection.id}`;
                  void navigator.clipboard.writeText(url).then(() => toast.success('Link copied'));
                }}
              >
                <Link2 aria-hidden />
                Copy link
              </Button>
            ) : null}
            {permissions.canEdit || permissions.canManage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Collection actions">
                    <Ellipsis aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52">
                  {permissions.canEdit && collection.items.length > 1 ? (
                    <DropdownMenuItem onSelect={() => setReordering(true)}>
                      <ArrowUpDown aria-hidden />
                      Reorder movies
                    </DropdownMenuItem>
                  ) : null}
                  {permissions.canManage ? (
                    <>
                      <DropdownMenuItem onSelect={() => setDialog('edit')}>
                        <Pencil aria-hidden />
                        Edit details
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
                        <ImagePlus aria-hidden />
                        Upload cover
                      </DropdownMenuItem>
                      {!collection.group ? (
                        <DropdownMenuItem onSelect={() => setDialog('share')}>
                          <Share2 aria-hidden />
                          Share…
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setDialog('delete')}>
                        <Trash2 aria-hidden />
                        Delete collection
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.target.value = '';
              }}
            />
          </div>
        </div>
      </div>

      {reordering ? (
        <ReorderList collection={collection} onDone={() => setReordering(false)} />
      ) : collection.items.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="This collection is empty"
          description={
            permissions.canEdit
              ? 'Add movies with the button above or from any movie card.'
              : 'The owner has not added movies yet.'
          }
        />
      ) : (
        <div className={GRID_CLASS}>
          {collection.items.map((item) => (
            <div key={item.movie.tmdbId} className="relative">
              <MovieCard
                movie={item.movie}
                footer={
                  <>
                    {item.note ? <span className="block italic">“{item.note}”</span> : null}
                    {item.addedBy && collection.group ? (
                      <span className="block">Added by {item.addedBy.displayName}</span>
                    ) : null}
                  </>
                }
              />
              {permissions.canEdit ? (
                <button
                  type="button"
                  aria-label={`Remove ${item.movie.title} from the collection`}
                  onClick={() => remove.mutate(item.movie.tmdbId)}
                  className="absolute left-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-red-600"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {dialog === 'add' ? (
        <MoviePickerDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={`Add to “${collection.name}”`}
          excludeIds={collection.items.map((item) => item.movie.tmdbId)}
          onPick={(movie) => add.mutateAsync({ collectionId: collection.id, tmdbId: movie.tmdbId })}
        />
      ) : null}
      {dialog === 'edit' ? (
        <CollectionFormDialog
          open
          collection={collection}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      ) : null}
      {dialog === 'share' ? (
        <ShareDialog
          open
          collection={collection}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      ) : null}
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Delete “${collection.name}”?`}
        description="The collection is removed for everyone. Movies stay in your catalog."
        confirmLabel="Delete"
        destructive
        loading={deleteCollection.isPending}
        onConfirm={() =>
          deleteCollection.mutate(collection.id, {
            onSuccess: () =>
              router.replace(collection.group ? `/groups/${collection.group.id}` : '/collections'),
          })
        }
      />
    </div>
  );
}
