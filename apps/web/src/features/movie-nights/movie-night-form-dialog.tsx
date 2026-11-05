'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form';
import { Avatar } from '@/components/ui/misc';
import type {
  MemberView,
  MovieNightCriteria,
  MovieNightDetails,
  WatchedFilter,
} from '@/lib/api/types';
import { US_CERTIFICATIONS } from '@/lib/constants';
import { useGenres } from '@/lib/queries/core';
import {
  type MovieNightInput,
  useCreateMovieNight,
  useUpdateMovieNight,
} from '@/lib/queries/movie-nights';
import { cn, toDateTimeLocal } from '@/lib/utils';

const WATCHED_OPTIONS: { value: WatchedFilter; label: string }[] = [
  { value: 'all', label: 'Skip movies everyone has seen' },
  { value: 'any', label: 'Skip movies anyone has seen' },
  { value: 'none', label: 'Include watched movies' },
];

function CriteriaFields({
  value,
  onChange,
}: {
  value: MovieNightCriteria;
  onChange: (value: MovieNightCriteria) => void;
}) {
  const { data: genres } = useGenres();
  const selected = value.genreIds ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Field label="Genres (any of)">
        <div className="flex flex-wrap gap-1.5">
          {(genres ?? []).map((genre) => {
            const active = selected.includes(genre.id);
            return (
              <button
                key={genre.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange({
                    ...value,
                    genreIds: active
                      ? selected.filter((id) => id !== genre.id)
                      : [...selected, genre.id],
                  })
                }
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {genre.name}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Min. TMDB rating" htmlFor="crit-rating">
          <Select
            id="crit-rating"
            value={value.minRating ?? ''}
            onChange={(event) =>
              onChange({
                ...value,
                minRating: event.target.value ? Number(event.target.value) : undefined,
              })
            }
          >
            <option value="">Any</option>
            {[6, 6.5, 7, 7.5, 8].map((rating) => (
              <option key={rating} value={rating}>
                {rating}+
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Max. length" htmlFor="crit-runtime">
          <Select
            id="crit-runtime"
            value={value.maxRuntime ?? ''}
            onChange={(event) =>
              onChange({
                ...value,
                maxRuntime: event.target.value ? Number(event.target.value) : undefined,
              })
            }
          >
            <option value="">Any</option>
            <option value="90">1h 30m</option>
            <option value="120">2h</option>
            <option value="150">2h 30m</option>
          </Select>
        </Field>
        <Field label="Age rating (US)" htmlFor="crit-cert">
          <Select
            id="crit-cert"
            value={value.maxCertification ?? ''}
            onChange={(event) =>
              onChange({
                ...value,
                maxCertification: event.target.value || undefined,
                certificationCountry: event.target.value ? 'US' : undefined,
              })
            }
          >
            <option value="">Any</option>
            {US_CERTIFICATIONS.map((cert) => (
              <option key={cert} value={cert}>
                Up to {cert}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Already watched" htmlFor="crit-watched">
        <Select
          id="crit-watched"
          value={value.excludeWatchedBy ?? 'all'}
          onChange={(event) =>
            onChange({ ...value, excludeWatchedBy: event.target.value as WatchedFilter })
          }
        >
          {WATCHED_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Checkbox
        label="Also suggest movies from participants' personal watchlists"
        checked={value.includeParticipantWatchlists ?? false}
        onChange={(event) =>
          onChange({ ...value, includeParticipantWatchlists: event.target.checked })
        }
      />
    </div>
  );
}

/** Plan a movie night for a group, or edit one that is still being planned. */
export function MovieNightFormDialog({
  open,
  onOpenChange,
  groupId,
  members,
  movieNight,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: MemberView[];
  movieNight?: MovieNightDetails;
}) {
  const router = useRouter();
  const create = useCreateMovieNight(groupId);
  const update = useUpdateMovieNight(movieNight?.id ?? '');
  const [title, setTitle] = useState(movieNight?.title ?? 'Movie night');
  const [description, setDescription] = useState(movieNight?.description ?? '');
  const [scheduledAt, setScheduledAt] = useState(toDateTimeLocal(movieNight?.scheduledAt));
  const [participants, setParticipants] = useState<string[]>(
    movieNight
      ? movieNight.participants.map((person) => person.id)
      : members.map((member) => member.id),
  );
  const [criteria, setCriteria] = useState<MovieNightCriteria>(
    movieNight?.criteria ?? { excludeWatchedBy: 'all' },
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const input: MovieNightInput = {
      title: title.trim(),
      description: description.trim() || null,
      // datetime-local has no zone: send an ISO timestamp in the viewer's time zone.
      scheduledAt: scheduledAt
        ? new Date(scheduledAt).toISOString()
        : movieNight
          ? null
          : undefined,
      participantIds: participants,
      criteria,
    };
    if (movieNight) {
      update.mutate(input, { onSuccess: () => onOpenChange(false) });
    } else {
      create.mutate(
        {
          ...input,
          title: input.title ?? 'Movie night',
          scheduledAt: input.scheduledAt ?? undefined,
        },
        {
          onSuccess: (night) => {
            onOpenChange(false);
            router.push(`/movie-nights/${night.id}`);
          },
        },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={movieNight ? 'Edit movie night' : 'Plan a movie night'}
        description="Pick a date, who is coming and what kind of movie you are in the mood for. Suggestions follow these criteria."
      >
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="night-title">
              <Input
                id="night-title"
                required
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field label="Date and time (optional)" htmlFor="night-date">
              <Input
                id="night-date"
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Description (optional)" htmlFor="night-description">
            <Textarea
              id="night-description"
              maxLength={1000}
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field label="Who is coming">
            <div className="flex flex-wrap gap-2">
              {members.map((member) => {
                const active = participants.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setParticipants((ids) =>
                        active ? ids.filter((id) => id !== member.id) : [...ids, member.id],
                      )
                    }
                    className={cn(
                      'flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors',
                      active ? 'border-primary bg-primary/10' : 'opacity-60 hover:opacity-100',
                    )}
                  >
                    <Avatar name={member.displayName} src={member.avatarUrl} size="xs" />
                    {member.displayName}
                  </button>
                );
              })}
            </div>
          </Field>
          <details className="rounded-xl border p-4" open={Boolean(movieNight)}>
            <summary className="cursor-pointer text-sm font-medium">
              What are you in the mood for?
            </summary>
            <div className="mt-4">
              <CriteriaFields value={criteria} onChange={setCriteria} />
            </div>
          </details>
          <DialogFooter className="mt-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={create.isPending || update.isPending}
              disabled={!title.trim() || participants.length === 0}
            >
              {movieNight ? 'Save' : 'Create movie night'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
