'use client';

import { Archive, ArchiveRestore, ImagePlus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Card } from '@/components/ui/misc';
import type { GroupDetails, GroupKind } from '@/lib/api/types';
import { GROUP_KIND_LABEL } from '@/lib/constants';
import {
  useArchiveGroup,
  useDeleteGroup,
  useUpdateGroup,
  useUploadGroupAvatar,
} from '@/lib/queries/groups';
import { GroupAvatar } from './groups-view';

export function GroupSettings({ group }: { group: GroupDetails }) {
  const router = useRouter();
  const update = useUpdateGroup(group.id);
  const upload = useUploadGroupAvatar(group.id);
  const archive = useArchiveGroup(group.id);
  const remove = useDeleteGroup();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [kind, setKind] = useState<GroupKind>(group.kind);
  const [confirm, setConfirm] = useState<'delete' | 'archive' | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const isOwner = group.myRole === 'owner';

  function save(event: FormEvent) {
    event.preventDefault();
    update.mutate({ name: name.trim(), description: description.trim() || null, kind });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card className="p-5">
        <h2 className="font-semibold">Group details</h2>
        <div className="mt-4 flex items-center gap-4">
          <GroupAvatar group={group} size="xl" />
          <div>
            <Button
              variant="outline"
              size="sm"
              loading={upload.isPending}
              disabled={group.archived}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus aria-hidden />
              Change picture
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG or WebP, up to 2 MB.</p>
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
        <form onSubmit={save} className="mt-5 flex flex-col gap-4">
          <Field label="Name" htmlFor="settings-name">
            <Input
              id="settings-name"
              required
              maxLength={80}
              value={name}
              disabled={group.archived}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Kind" htmlFor="settings-kind">
            <Select
              id="settings-kind"
              value={kind}
              disabled={group.archived}
              onChange={(event) => setKind(event.target.value as GroupKind)}
            >
              {Object.entries(GROUP_KIND_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="settings-description">
            <Textarea
              id="settings-description"
              maxLength={500}
              value={description}
              disabled={group.archived}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <div>
            <Button
              type="submit"
              loading={update.isPending}
              disabled={group.archived || !name.trim()}
            >
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      {isOwner ? (
        <Card className="border-red-500/30 p-5">
          <h2 className="font-semibold">Owner actions</h2>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {group.archived ? 'Restore the group' : 'Archive the group'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {group.archived
                    ? 'Members can add movies and plan movie nights again.'
                    : 'Keeps everything read-only. You can restore it later.'}
                </p>
              </div>
              <Button
                variant="outline"
                loading={archive.isPending}
                onClick={() => (group.archived ? archive.mutate(false) : setConfirm('archive'))}
              >
                {group.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
                {group.archived ? 'Restore' : 'Archive'}
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Delete the group</p>
                <p className="text-xs text-muted-foreground">
                  Removes the catalog, ratings, comments, collections and movie nights for everyone.
                </p>
              </div>
              <Button variant="danger" onClick={() => setConfirm('delete')}>
                <Trash2 aria-hidden />
                Delete
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Archive ${group.name}?`}
        description="The group becomes read-only for all members until you restore it."
        confirmLabel="Archive"
        loading={archive.isPending}
        onConfirm={() => archive.mutate(true, { onSuccess: () => setConfirm(null) })}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null);
            setConfirmName('');
          }
        }}
        title={`Delete ${group.name}?`}
        description="This cannot be undone. Type the group name to confirm."
        confirmLabel="Delete forever"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (confirmName.trim() === group.name)
            remove.mutate(group.id, { onSuccess: () => router.replace('/groups') });
        }}
      >
        <Input
          value={confirmName}
          onChange={(event) => setConfirmName(event.target.value)}
          placeholder={group.name}
          aria-label="Group name"
        />
      </ConfirmDialog>
    </div>
  );
}
