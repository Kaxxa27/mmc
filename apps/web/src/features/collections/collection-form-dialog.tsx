'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form';
import type { CollectionSummary, CollectionVisibility } from '@/lib/api/types';
import { VISIBILITY_META } from '@/lib/constants';
import { useCreateCollection, useUpdateCollection } from '@/lib/queries/collections';
import { cn } from '@/lib/utils';

function VisibilityPicker({
  value,
  onChange,
  options,
}: {
  value: CollectionVisibility;
  onChange: (value: CollectionVisibility) => void;
  options: CollectionVisibility[];
}) {
  return (
    <div className="grid gap-2" role="radiogroup" aria-label="Visibility">
      {options.map((option) => {
        const meta = VISIBILITY_META[option];
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left transition-colors',
              active ? 'border-primary bg-primary/5' : 'hover:bg-muted',
            )}
          >
            <span className="block text-sm font-medium">{meta.label}</span>
            <span className="block text-xs text-muted-foreground">{meta.description}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Create a personal or group collection, or edit an existing one. */
export function CollectionFormDialog({
  open,
  onOpenChange,
  collection,
  groupId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection?: CollectionSummary;
  groupId?: string;
}) {
  const router = useRouter();
  const isGroup = Boolean(groupId ?? collection?.group);
  const options: CollectionVisibility[] = isGroup
    ? ['shared', 'public']
    : ['private', 'shared', 'public'];
  const [name, setName] = useState(collection?.name ?? '');
  const [description, setDescription] = useState(collection?.description ?? '');
  const [visibility, setVisibility] = useState<CollectionVisibility>(
    collection?.visibility ?? (isGroup ? 'shared' : 'private'),
  );
  const create = useCreateCollection();
  const update = useUpdateCollection(collection?.id ?? '');

  function submit(event: FormEvent) {
    event.preventDefault();
    const input = { name: name.trim(), description: description.trim() || null, visibility };
    if (collection) {
      update.mutate(input, { onSuccess: () => onOpenChange(false) });
    } else {
      create.mutate(
        { ...input, ...(groupId ? { groupId } : {}) },
        {
          onSuccess: (created) => {
            onOpenChange(false);
            router.push(`/collections/${created.id}`);
          },
        },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={collection ? 'Edit collection' : isGroup ? 'New group collection' : 'New collection'}
        description={
          isGroup
            ? 'Every group member can add movies to it.'
            : 'A named list of movies, e.g. “Christmas movies” or “Best of Pixar”.'
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Name" htmlFor="collection-name">
            <Input
              id="collection-name"
              required
              autoFocus
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Description (optional)" htmlFor="collection-description">
            <Textarea
              id="collection-description"
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field label="Who can see it">
            <VisibilityPicker value={visibility} onChange={setVisibility} options={options} />
          </Field>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={create.isPending || update.isPending}
              disabled={!name.trim()}
            >
              {collection ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
