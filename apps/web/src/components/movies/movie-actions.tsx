'use client';

import { Check, FolderPlus, Heart, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import type { MovieSummary } from '@/lib/api/types';
import { MOVIE_STATUS_META, MOVIE_STATUSES } from '@/lib/constants';
import { useMe } from '@/lib/queries/core';
import { useRemoveLibraryEntry, useUpdateLibraryEntry } from '@/lib/queries/library';
import { AddToCollectionDialog } from './add-to-collection-dialog';
import { AddToGroupDialog } from './add-to-group-dialog';
import { LibraryEntryDialog } from './library-entry-dialog';

type MovieRef = Pick<MovieSummary, 'tmdbId' | 'title' | 'userState'>;

export type MovieDialog = 'entry' | 'collection' | 'group' | null;

/** Dialogs opened from movie menus; rendered outside the menu so focus handling stays correct. */
export function MovieDialogs({
  movie,
  open,
  onOpenChange,
}: {
  movie: MovieRef;
  open: MovieDialog;
  onOpenChange: (dialog: MovieDialog) => void;
}) {
  const close = (value: boolean) => {
    if (!value) onOpenChange(null);
  };
  return (
    <>
      {open === 'entry' ? <LibraryEntryDialog movie={movie} open onOpenChange={close} /> : null}
      {open === 'collection' ? (
        <AddToCollectionDialog movie={movie} open onOpenChange={close} />
      ) : null}
      {open === 'group' ? <AddToGroupDialog movie={movie} open onOpenChange={close} /> : null}
    </>
  );
}

/** Status, favorite and "add to…" actions for a movie. Guests are sent to sign in. */
export function MovieActionsMenu({
  movie,
  trigger,
  align = 'end',
}: {
  movie: MovieRef;
  trigger: ReactNode;
  align?: 'start' | 'end';
}) {
  const router = useRouter();
  const { data: me } = useMe();
  const [dialog, setDialog] = useState<MovieDialog>(null);
  const update = useUpdateLibraryEntry((entry) =>
    entry.status
      ? `${movie.title}: ${MOVIE_STATUS_META[entry.status].label}`
      : `${movie.title} saved`,
  );
  const remove = useRemoveLibraryEntry();
  const state = movie.userState;

  if (!me) {
    return (
      <span
        onClickCapture={(event) => {
          event.preventDefault();
          event.stopPropagation();
          router.push(`/sign-in?next=${encodeURIComponent(`/movies/${movie.tmdbId}`)}`);
        }}
      >
        {trigger}
      </span>
    );
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          className="w-60"
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          {MOVIE_STATUSES.map((status) => {
            const meta = MOVIE_STATUS_META[status];
            const Icon = meta.icon;
            const active = state?.status === status;
            return (
              <DropdownMenuItem
                key={status}
                onSelect={() =>
                  update.mutate({ tmdbId: movie.tmdbId, status: active ? null : status })
                }
              >
                <Icon aria-hidden />
                {meta.label}
                {active ? <Check className="ml-auto !text-primary" aria-label="current" /> : null}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => update.mutate({ tmdbId: movie.tmdbId, isFavorite: !state?.isFavorite })}
          >
            <Heart
              className={state?.isFavorite ? '!fill-rose-500 !text-rose-500' : undefined}
              aria-hidden
            />
            {state?.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('entry')}>
            {state ? <Pencil aria-hidden /> : <Plus aria-hidden />}
            Rating, notes & viewing…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog('collection')}>
            <FolderPlus aria-hidden />
            Add to collection…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('group')}>
            <Users aria-hidden />
            Add to group catalog…
          </DropdownMenuItem>
          {state ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onSelect={() => remove.mutate({ tmdbId: movie.tmdbId })}
              >
                <Trash2 aria-hidden />
                Remove from my catalog
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <MovieDialogs movie={movie} open={dialog} onOpenChange={setDialog} />
    </>
  );
}
