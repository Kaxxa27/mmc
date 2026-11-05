'use client';

import { Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MovieGrid, MovieGridSkeleton } from '@/components/movies/movie-grid';
import { Input } from '@/components/ui/form';
import { EmptyState, ErrorState } from '@/components/ui/misc';
import { Pagination } from '@/components/ui/pagination';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useUrlState } from '@/hooks/use-url-state';
import type { PersonSummary } from '@/lib/api/types';
import { useSearch } from '@/lib/queries/movies';

function PersonChip({ person }: { person: PersonSummary }) {
  return (
    <Link
      href={`/people/${person.tmdbId}`}
      className="flex w-28 shrink-0 flex-col items-center gap-2 text-center"
    >
      <span className="size-20 overflow-hidden rounded-full bg-muted">
        {person.profileUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- TMDB profile image
          <img src={person.profileUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <UserRound className="m-5 size-10 text-muted-foreground" aria-hidden />
        )}
      </span>
      <span className="line-clamp-2 text-sm font-medium leading-tight">{person.name}</span>
      {person.knownForDepartment ? (
        <span className="-mt-1 text-xs text-muted-foreground">{person.knownForDepartment}</span>
      ) : null}
    </Link>
  );
}

export function SearchView() {
  const url = useUrlState();
  const { set } = url;
  const query = url.get('q') ?? '';
  const [value, setValue] = useState(query);
  const [lastQuery, setLastQuery] = useState(query);
  const debounced = useDebouncedValue(value.trim(), 350);
  const { data, isFetching, error, refetch } = useSearch(query, url.page);

  // A new search from the header updates the box.
  if (query !== lastQuery) {
    setLastQuery(query);
    if (query !== value.trim()) setValue(query);
  }

  // Typing updates the URL, so searches can be shared and survive reloads.
  useEffect(() => {
    const current = new URLSearchParams(window.location.search).get('q') ?? '';
    if (debounced !== current) set({ q: debounced || null });
  }, [debounced, set]);

  return (
    <div>
      <h1 className="sr-only">Search</h1>
      <div className="relative mx-auto mb-8 max-w-2xl">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search by title, original title or actor…"
          aria-label="Search movies and people"
          className="h-14 rounded-2xl pl-12 text-base"
        />
      </div>

      {!query ? (
        <EmptyState
          icon={Search}
          title="Find any movie"
          description="Search works with partial titles, original titles and alternative titles — and finds actors and directors too."
        />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data ? (
        <MovieGridSkeleton count={12} />
      ) : (
        <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
          {data.people.length > 0 ? (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-semibold">People</h2>
              <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
                {data.people.map((person) => (
                  <PersonChip key={person.tmdbId} person={person} />
                ))}
              </div>
            </section>
          ) : null}
          <section>
            <h2 className="mb-4 text-lg font-semibold">
              Movies{' '}
              <span className="text-sm font-normal text-muted-foreground">
                ({data.movies.totalResults.toLocaleString('en-US')})
              </span>
            </h2>
            {data.movies.items.length === 0 ? (
              <EmptyState
                icon={Search}
                title={`No movies found for “${query}”`}
                description="Check the spelling or try the original title."
              />
            ) : (
              <>
                <MovieGrid movies={data.movies.items} />
                <Pagination
                  page={url.page}
                  totalPages={Math.min(data.movies.totalPages, 500)}
                  onChange={(page) => {
                    url.set({ page }, { keepPage: true });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
