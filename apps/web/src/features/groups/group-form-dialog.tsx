'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import type { GroupKind } from '@/lib/api/types';
import { GROUP_KIND_LABEL } from '@/lib/constants';
import { useCreateGroup } from '@/lib/queries/groups';

export function CreateGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const create = useCreateGroup();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<GroupKind>('family');

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { name: name.trim(), description: description.trim() || null, kind },
      {
        onSuccess: (group) => {
          onOpenChange(false);
          router.push(`/groups/${group.id}?tab=members`);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Create a group"
        description="A shared space for family or friends: a common movie list, ratings, comments and movie nights."
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Name" htmlFor="group-name">
            <Input
              id="group-name"
              required
              autoFocus
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="The Smiths"
            />
          </Field>
          <Field label="Kind" htmlFor="group-kind">
            <Select
              id="group-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as GroupKind)}
            >
              {Object.entries(GROUP_KIND_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description (optional)" htmlFor="group-description">
            <Textarea
              id="group-description"
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
