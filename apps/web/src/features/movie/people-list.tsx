import { UserRound } from 'lucide-react';
import Link from 'next/link';
import type { CastMember, MovieCrew } from '@/lib/api/types';

export function CastList({ cast }: { cast: CastMember[] }) {
  if (cast.length === 0)
    return <p className="text-sm text-muted-foreground">No cast information.</p>;
  return (
    <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
      {cast.slice(0, 20).map((member) => (
        <Link
          key={`${member.tmdbId}-${member.order}`}
          href={`/people/${member.tmdbId}`}
          className="group w-28 shrink-0"
        >
          <span className="block aspect-[2/3] overflow-hidden rounded-xl bg-muted">
            {member.profileUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- TMDB profile image
              <img
                src={member.profileUrl}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <span className="flex size-full items-center justify-center">
                <UserRound className="size-10 text-muted-foreground" aria-hidden />
              </span>
            )}
          </span>
          <span className="mt-2 block text-sm font-medium leading-tight group-hover:underline">
            {member.name}
          </span>
          {member.character ? (
            <span className="block text-xs text-muted-foreground">{member.character}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

const CREW_ROLES: { key: keyof MovieCrew; label: string }[] = [
  { key: 'directors', label: 'Directed by' },
  { key: 'writers', label: 'Written by' },
  { key: 'producers', label: 'Produced by' },
  { key: 'cinematographers', label: 'Cinematography' },
  { key: 'composers', label: 'Music' },
  { key: 'editors', label: 'Editing' },
];

export function CrewList({ crew }: { crew: MovieCrew }) {
  const roles = CREW_ROLES.filter((role) => crew[role.key].length > 0);
  if (roles.length === 0) return null;
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {roles.map((role) => (
        <div key={role.key}>
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {role.label}
          </dt>
          <dd className="mt-1 text-sm">
            {crew[role.key].slice(0, 6).map((person, index) => (
              <span key={`${person.tmdbId}-${person.job}`}>
                {index > 0 ? ', ' : null}
                <Link href={`/people/${person.tmdbId}`} className="hover:underline">
                  {person.name}
                </Link>
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
