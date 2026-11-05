'use client';

import { Check, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/form';
import { Avatar, Spinner } from '@/components/ui/misc';
import type { MovieSummary } from '@/lib/api/types';
import { useAddGroupMovie, useGroups } from '@/lib/queries/groups';
import { plural } from '@/lib/utils';

type MovieRef = Pick<MovieSummary, 'tmdbId' | 'title'>;

export function AddToGroupDialog({
  movie,
  open,
  onOpenChange,
}: {
  movie: MovieRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: groups, isPending } = useGroups();
  const add = useAddGroupMovie();
  const [note, setNote] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const active = (groups ?? []).filter((group) => !group.archived);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Add to a group catalog"
        description={`${movie.title} — the group's shared list of movies to watch.`}
      >
        {isPending ? (
          <Spinner />
        ) : active.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            <p>You are not in any group yet.</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/groups" onClick={() => onOpenChange(false)}>
                Create a group
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <Input
              value={note}
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note, e.g. “For the next family evening”"
              aria-label="Note"
              className="mb-3"
            />
            <ul className="flex flex-col gap-1">
              {active.map((group) => {
                const done = added.includes(group.id);
                return (
                  <li
                    key={group.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60"
                  >
                    {group.avatarUrl ? (
                      <Avatar name={group.name} src={group.avatarUrl} size="sm" />
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded-full bg-muted">
                        <Users className="size-4 text-muted-foreground" aria-hidden />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{group.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {plural(group.memberCount, 'member')} · {plural(group.movieCount, 'movie')}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant={done ? 'secondary' : 'outline'}
                      disabled={done}
                      loading={add.isPending && add.variables?.groupId === group.id}
                      onClick={() =>
                        add.mutate(
                          { groupId: group.id, tmdbId: movie.tmdbId, note: note.trim() || null },
                          { onSuccess: () => setAdded((ids) => [...ids, group.id]) },
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
