'use client';

import { Check } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Card, Spinner } from '@/components/ui/misc';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { errorMessage } from '@/lib/api/client';
import type { ProfileView } from '@/lib/api/types';
import { LANGUAGES, REGIONS } from '@/lib/constants';
import { checkUsername, useCompleteOnboarding } from '@/lib/queries/account';
import { useGenres, useMe } from '@/lib/queries/core';
import { cn, safeNext } from '@/lib/utils';

const USERNAME = /^[a-z0-9_]{3,30}$/;

/** Live availability check for a username (empty = no username). */
export function useUsernameStatus(value: string, current: string | null) {
  const username = useDebouncedValue(value.trim().toLowerCase(), 400);
  const [result, setResult] = useState<{ username: string; available: boolean } | null>(null);
  const valid = USERNAME.test(username);

  useEffect(() => {
    if (!valid || username === current) return;
    const controller = new AbortController();
    checkUsername(username, controller.signal)
      .then((response) => setResult(response))
      .catch(() => undefined);
    return () => controller.abort();
  }, [username, valid, current]);

  const typed = value.trim().toLowerCase();
  if (!typed || typed === current) return { state: 'idle' as const, message: null };
  if (!USERNAME.test(typed))
    return { state: 'invalid' as const, message: '3-30 lowercase letters, digits or underscores.' };
  if (typed !== username || result?.username !== typed)
    return { state: 'checking' as const, message: 'Checking…' };
  return result.available
    ? { state: 'available' as const, message: `@${typed} is available.` }
    : { state: 'taken' as const, message: `@${typed} is already taken.` };
}

export function GenrePicker({
  value,
  onChange,
  max = 10,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  max?: number;
}) {
  const { data: genres, isPending } = useGenres();
  if (isPending) return <Spinner className="py-4" />;
  return (
    <div className="flex flex-wrap gap-2">
      {(genres ?? []).map((genre) => {
        const selected = value.includes(genre.id);
        return (
          <button
            key={genre.id}
            type="button"
            aria-pressed={selected}
            disabled={!selected && value.length >= max}
            onClick={() =>
              onChange(selected ? value.filter((id) => id !== genre.id) : [...value, genre.id])
            }
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-40',
              selected ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {selected ? <Check className="size-3.5" aria-hidden /> : null}
            {genre.name}
          </button>
        );
      })}
    </div>
  );
}

function OnboardingForm({ me, next }: { me: ProfileView; next: string }) {
  const router = useRouter();
  const complete = useCompleteOnboarding();
  const [firstName, setFirstName] = useState(me.firstName ?? '');
  const [lastName, setLastName] = useState(me.lastName ?? '');
  const [username, setUsername] = useState(me.username ?? '');
  const [language, setLanguage] = useState(me.language);
  const [region, setRegion] = useState(me.region);
  const [genres, setGenres] = useState<number[]>(me.favoriteGenres.map((genre) => genre.id));
  const usernameStatus = useUsernameStatus(username, me.username);

  function submit(event: FormEvent) {
    event.preventDefault();
    complete.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        ...(username.trim() ? { username: username.trim().toLowerCase() } : {}),
        language,
        region,
        favoriteGenreIds: genres,
      },
      { onSuccess: () => router.replace(next) },
    );
  }

  const blocked =
    usernameStatus.state === 'invalid' ||
    usernameStatus.state === 'taken' ||
    usernameStatus.state === 'checking';

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName">
          <Input
            id="firstName"
            required
            maxLength={60}
            autoFocus
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </Field>
        <Field label="Last name (optional)" htmlFor="lastName">
          <Input
            id="lastName"
            maxLength={60}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </Field>
      </div>
      <Field
        label="Username (optional)"
        htmlFor="username"
        hint={
          usernameStatus.message ??
          'Friends can share collections with you and @mention you in comments.'
        }
        error={
          usernameStatus.state === 'invalid' || usernameStatus.state === 'taken'
            ? usernameStatus.message
            : null
        }
      >
        <Input
          id="username"
          value={username}
          maxLength={30}
          autoCapitalize="none"
          autoComplete="username"
          onChange={(event) => setUsername(event.target.value)}
          placeholder="anna_smith"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Movie language" htmlFor="language" hint="Titles and descriptions.">
          <Select
            id="language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Country" htmlFor="region" hint="Age ratings, release dates, where to watch.">
          <Select id="region" value={region} onChange={(event) => setRegion(event.target.value)}>
            {REGIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Favorite genres" hint="Pick a few — they shape your recommendations.">
        <GenrePicker value={genres} onChange={setGenres} />
      </Field>
      {complete.error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {errorMessage(complete.error)}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        loading={complete.isPending}
        disabled={!firstName.trim() || blocked}
      >
        Start exploring
      </Button>
    </form>
  );
}

export function OnboardingView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = safeNext(searchParams.get('next'));
  const { data: me, isPending } = useMe();

  useEffect(() => {
    if (me?.onboardingCompleted) router.replace(next);
    if (me === null) router.replace(`/sign-in?next=${encodeURIComponent('/onboarding')}`);
  }, [me, next, router]);

  return (
    <Card className="w-full max-w-xl p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight">Welcome to My Movie Catalog</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tell us a little about yourself. You can change this later in settings.
      </p>
      <div className="mt-6">
        {isPending || !me ? <Spinner /> : <OnboardingForm me={me} next={next} />}
      </div>
    </Card>
  );
}
