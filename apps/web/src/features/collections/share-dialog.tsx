'use client';

import { Trash2, UserRound, Users } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/form';
import { Spinner } from '@/components/ui/misc';
import type { CollectionSummary } from '@/lib/api/types';
import {
  useCollectionShares,
  useShareCollection,
  useUnshareCollection,
} from '@/lib/queries/collections';
import { useGroups } from '@/lib/queries/groups';

export function ShareDialog({
  collection,
  open,
  onOpenChange,
}: {
  collection: CollectionSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: shares, isPending } = useCollectionShares(collection.id, open);
  const { data: groups } = useGroups();
  const share = useShareCollection(collection.id);
  const unshare = useUnshareCollection(collection.id);
  const [username, setUsername] = useState('');
  const [groupId, setGroupId] = useState('');

  function shareWithUser(event: FormEvent) {
    event.preventDefault();
    const value = username.trim().replace(/^@/, '').toLowerCase();
    if (value) share.mutate({ username: value }, { onSuccess: () => setUsername('') });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Share collection"
        description={
          collection.visibility === 'shared'
            ? 'People and groups below can see this collection.'
            : 'Shares apply while the visibility is “Shared” — change it under “Edit details”.'
        }
      >
        <form onSubmit={shareWithUser} className="flex gap-2">
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username, e.g. ben_demo"
            aria-label="Username"
            autoCapitalize="none"
          />
          <Button
            type="submit"
            variant="secondary"
            loading={share.isPending && Boolean(username)}
            disabled={!username.trim()}
          >
            Share
          </Button>
        </form>
        {groups && groups.length > 0 ? (
          <div className="mt-3 flex gap-2">
            <Select
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              aria-label="Group"
            >
              <option value="">Share with a group…</option>
              {groups
                .filter((group) => !group.archived)
                .map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
            </Select>
            <Button
              variant="secondary"
              disabled={!groupId}
              loading={share.isPending && Boolean(groupId)}
              onClick={() => share.mutate({ groupId }, { onSuccess: () => setGroupId('') })}
            >
              Share
            </Button>
          </div>
        ) : null}

        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold">Shared with</p>
          {isPending ? (
            <Spinner className="py-4" />
          ) : !shares || shares.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not shared with anyone yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {shares.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                  {item.group ? (
                    <Users className="size-4 text-muted-foreground" aria-hidden />
                  ) : (
                    <UserRound className="size-4 text-muted-foreground" aria-hidden />
                  )}
                  <span className="flex-1 truncate text-sm">
                    {item.group ? item.group.name : (item.user?.displayName ?? 'Unknown')}
                    {item.user?.username ? (
                      <span className="text-muted-foreground"> @{item.user.username}</span>
                    ) : null}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Stop sharing"
                    loading={unshare.isPending && unshare.variables === item.id}
                    onClick={() => unshare.mutate(item.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
