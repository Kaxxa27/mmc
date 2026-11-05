'use client';

import { UserRound } from 'lucide-react';
import { useState } from 'react';
import { MovieGrid } from '@/components/movies/movie-grid';
import { Button } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/misc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PersonMovieCredit } from '@/lib/api/types';
import { usePerson } from '@/lib/queries/movies';
import { formatDate } from '@/lib/utils';

function age(birthday: string, deathday: string | null): number | null {
  const born = new Date(`${birthday}T12:00:00`);
  const end = deathday ? new Date(`${deathday}T12:00:00`) : new Date();
  if (Number.isNaN(born.getTime())) return null;
  let years = end.getFullYear() - born.getFullYear();
  const beforeBirthday =
    end.getMonth() < born.getMonth() ||
    (end.getMonth() === born.getMonth() && end.getDate() < born.getDate());
  if (beforeBirthday) years -= 1;
  return years;
}

function byNewest(credits: PersonMovieCredit[]) {
  return [...credits].sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
}

export function PersonView({ personId }: { personId: number }) {
  const { data: person, isPending, error, refetch } = usePerson(personId);
  const [expanded, setExpanded] = useState(false);

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending) {
    return (
      <div className="flex gap-8">
        <Skeleton className="aspect-[2/3] w-48 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-9 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  const credits = [
    {
      key: 'acting',
      label: 'Acting',
      items: byNewest(person.acting),
      footer: (c: PersonMovieCredit) => c.character,
    },
    {
      key: 'directing',
      label: 'Directing',
      items: byNewest(person.directing),
      footer: (c: PersonMovieCredit) => c.job,
    },
    {
      key: 'writing',
      label: 'Writing',
      items: byNewest(person.writing),
      footer: (c: PersonMovieCredit) => c.job,
    },
    {
      key: 'producing',
      label: 'Producing',
      items: byNewest(person.producing),
      footer: (c: PersonMovieCredit) => c.job,
    },
  ].filter((group) => group.items.length > 0);
  const years = person.birthday ? age(person.birthday, person.deathday) : null;
  const bio = person.biography ?? '';
  const longBio = bio.length > 600;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="w-44 shrink-0 self-start overflow-hidden rounded-2xl bg-muted shadow-lg sm:w-56">
          {person.profileUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- TMDB profile image
            <img
              src={person.profileUrl}
              alt={person.name}
              className="aspect-[2/3] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center">
              <UserRound className="size-16 text-muted-foreground" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{person.name}</h1>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {person.knownForDepartment ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Known for
                </dt>
                <dd>{person.knownForDepartment}</dd>
              </div>
            ) : null}
            {person.birthday ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Born
                </dt>
                <dd>
                  {formatDate(person.birthday)}
                  {years !== null && !person.deathday ? ` (age ${years})` : ''}
                </dd>
              </div>
            ) : null}
            {person.deathday ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Died
                </dt>
                <dd>
                  {formatDate(person.deathday)}
                  {years !== null ? ` (aged ${years})` : ''}
                </dd>
              </div>
            ) : null}
            {person.placeOfBirth ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Place of birth
                </dt>
                <dd>{person.placeOfBirth}</dd>
              </div>
            ) : null}
          </dl>
          {bio ? (
            <div className="mt-6 max-w-3xl">
              <h2 className="text-sm font-semibold">Biography</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {longBio && !expanded ? `${bio.slice(0, 600).trimEnd()}…` : bio}
              </p>
              {longBio ? (
                <Button variant="link" size="sm" onClick={() => setExpanded((value) => !value)}>
                  {expanded ? 'Show less' : 'Read more'}
                </Button>
              ) : null}
            </div>
          ) : null}
          {person.alsoKnownAs.length ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Also known as {person.alsoKnownAs.slice(0, 5).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>

      {credits.length > 0 ? (
        <Tabs defaultValue={credits[0]!.key}>
          <TabsList>
            {credits.map((group) => (
              <TabsTrigger key={group.key} value={group.key}>
                {group.label}{' '}
                <span className="text-xs text-muted-foreground">{group.items.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {credits.map((group) => (
            <TabsContent key={group.key} value={group.key} className="pt-6">
              <MovieGrid
                movies={group.items}
                footer={(movie) => group.footer(movie as PersonMovieCredit)}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : null}
    </div>
  );
}
