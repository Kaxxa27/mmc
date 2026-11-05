'use client';

import { Compass, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { MovieGrid, MovieGridSkeleton } from '@/components/movies/movie-grid';
import { MovieRow } from '@/components/movies/movie-row';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/misc';
import { Pagination } from '@/components/ui/pagination';
import { useUrlState } from '@/hooks/use-url-state';
import { US_CERTIFICATIONS } from '@/lib/constants';
import { useGenres, useMe } from '@/lib/queries/core';
import { useRecommendations } from '@/lib/queries/discovery';
import {
  type DiscoverFilters,
  type MovieListKind,
  useDiscover,
  useMovieList,
} from '@/lib/queries/movies';
import { cn } from '@/lib/utils';

const LISTS: { value: MovieListKind | 'for-you'; label: string; private?: boolean }[] = [
  { value: 'for-you', label: 'For you', private: true },
  { value: 'popular', label: 'Popular' },
  { value: 'trending', label: 'Trending' },
  { value: 'top-rated', label: 'Top rated' },
  { value: 'now-playing', label: 'In theaters' },
  { value: 'upcoming', label: 'Coming soon' },
];

const SORTS = [
  { value: 'popularity', label: 'Most popular' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title', label: 'Title A–Z' },
];

const FILTER_KEYS = [
  'genres',
  'match',
  'from',
  'to',
  'rating',
  'runtime',
  'cert',
  'lang',
  'release',
  'sort',
];

const ORIGINAL_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ru', label: 'Russian' },
  { value: 'zh', label: 'Chinese' },
];

function ListResults({
  list,
  page,
  onPage,
}: {
  list: MovieListKind;
  page: number;
  onPage: (page: number) => void;
}) {
  const { data, isPending, error, refetch } = useMovieList(
    list,
    page,
    list === 'trending' ? 'week' : undefined,
  );
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending) return <MovieGridSkeleton count={18} />;
  return (
    <>
      <MovieGrid movies={data.items} />
      <Pagination page={page} totalPages={Math.min(data.totalPages, 500)} onChange={onPage} />
    </>
  );
}

function DiscoverResults({
  filters,
  onPage,
}: {
  filters: DiscoverFilters;
  onPage: (page: number) => void;
}) {
  const { data, isPending, error, refetch } = useDiscover(filters);
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending) return <MovieGridSkeleton count={18} />;
  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="No movies match these filters"
        description="Try fewer genres or a wider year range."
      />
    );
  }
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {data.totalResults.toLocaleString('en-US')} {data.totalResults === 1 ? 'movie' : 'movies'}
      </p>
      <MovieGrid movies={data.items} />
      <Pagination
        page={filters.page ?? 1}
        totalPages={Math.min(data.totalPages, 500)}
        onChange={onPage}
      />
    </>
  );
}

function ForYou() {
  const { data: sections, isPending, error, refetch } = useRecommendations();
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending) return <MovieRow title="Picked for you" movies={undefined} loading />;
  if (sections.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="Nothing to recommend yet"
        description="Rate a few movies and pick favorite genres in settings — recommendations get better as your catalog grows."
      />
    );
  }
  return (
    <div className="flex flex-col gap-10">
      {sections.map((section) => (
        <MovieRow key={section.key + section.title} title={section.title} movies={section.movies} />
      ))}
    </div>
  );
}

export function DiscoverView() {
  const { data: me } = useMe();
  const { data: genres } = useGenres();
  const url = useUrlState();
  const [showFilters, setShowFilters] = useState(() =>
    FILTER_KEYS.some((key) => url.searchParams.has(key)),
  );

  const genreIds = url.getList('genres').map(Number).filter(Number.isFinite);
  const filters: DiscoverFilters = {
    genreIds: genreIds.length ? genreIds : undefined,
    genreMatch: url.get('match') === 'all' ? 'all' : undefined,
    yearFrom: url.getNumber('from'),
    yearTo: url.getNumber('to'),
    minRating: url.getNumber('rating'),
    maxRuntime: url.getNumber('runtime'),
    maxCertification: url.get('cert'),
    originalLanguage: url.get('lang'),
    releaseState: (url.get('release') as DiscoverFilters['releaseState']) ?? undefined,
    sort: (url.get('sort') as DiscoverFilters['sort']) ?? undefined,
    page: url.page,
  };
  const filtering = FILTER_KEYS.some((key) => url.searchParams.has(key));
  const lists = LISTS.filter((list) => !list.private || me);
  const requested = url.get('list');
  const list = lists.find((item) => item.value === requested)?.value ?? 'popular';

  function toggleGenre(id: number) {
    const next = genreIds.includes(id)
      ? genreIds.filter((value) => value !== id)
      : [...genreIds, id];
    url.set({ genres: next, list: null });
  }

  function setPage(page: number) {
    url.set({ page }, { keepPage: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div>
      <PageHeader
        title="Discover"
        description="Browse what is popular, trending or coming soon — or filter by genre, year, rating and length."
        actions={
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            onClick={() => setShowFilters((value) => !value)}
          >
            <SlidersHorizontal aria-hidden />
            Filters
          </Button>
        }
      />

      {!filtering ? (
        <div className="scrollbar-none mb-6 flex gap-2 overflow-x-auto">
          {lists.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => url.set({ list: item.value === 'popular' ? null : item.value })}
              className={cn(
                'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                list === item.value
                  ? 'border-foreground bg-foreground text-background'
                  : 'hover:bg-muted',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {showFilters ? (
        <div className="mb-8 rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {(genres ?? []).map((genre) => (
              <button
                key={genre.id}
                type="button"
                aria-pressed={genreIds.includes(genre.id)}
                onClick={() => toggleGenre(genre.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  genreIds.includes(genre.id)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                {genre.name}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Field label="Genres match" htmlFor="f-match">
              <Select
                id="f-match"
                value={url.get('match') ?? 'any'}
                onChange={(event) =>
                  url.set({ match: event.target.value === 'all' ? 'all' : null })
                }
              >
                <option value="any">Any selected</option>
                <option value="all">All selected</option>
              </Select>
            </Field>
            <Field label="From year" htmlFor="f-from">
              <Input
                id="f-from"
                key={`from-${url.get('from') ?? ''}`}
                type="number"
                min={1870}
                max={2100}
                placeholder="1990"
                defaultValue={url.get('from')}
                onBlur={(event) => url.set({ from: event.target.value || null })}
              />
            </Field>
            <Field label="To year" htmlFor="f-to">
              <Input
                id="f-to"
                key={`to-${url.get('to') ?? ''}`}
                type="number"
                min={1870}
                max={2100}
                placeholder="2026"
                defaultValue={url.get('to')}
                onBlur={(event) => url.set({ to: event.target.value || null })}
              />
            </Field>
            <Field label="Min. rating" htmlFor="f-rating">
              <Select
                id="f-rating"
                value={url.get('rating') ?? ''}
                onChange={(event) => url.set({ rating: event.target.value || null })}
              >
                <option value="">Any</option>
                {[5, 6, 7, 7.5, 8, 8.5].map((value) => (
                  <option key={value} value={value}>
                    {value}+
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Max. length" htmlFor="f-runtime">
              <Select
                id="f-runtime"
                value={url.get('runtime') ?? ''}
                onChange={(event) => url.set({ runtime: event.target.value || null })}
              >
                <option value="">Any</option>
                <option value="90">1h 30m</option>
                <option value="120">2h</option>
                <option value="150">2h 30m</option>
              </Select>
            </Field>
            <Field label="Age rating (US)" htmlFor="f-cert">
              <Select
                id="f-cert"
                value={url.get('cert') ?? ''}
                onChange={(event) => url.set({ cert: event.target.value || null })}
              >
                <option value="">Any</option>
                {US_CERTIFICATIONS.map((value) => (
                  <option key={value} value={value}>
                    Up to {value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Language" htmlFor="f-lang">
              <Select
                id="f-lang"
                value={url.get('lang') ?? ''}
                onChange={(event) => url.set({ lang: event.target.value || null })}
              >
                <option value="">Any</option>
                {ORIGINAL_LANGUAGES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sort by" htmlFor="f-sort">
              <Select
                id="f-sort"
                value={url.get('sort') ?? 'popularity'}
                onChange={(event) =>
                  url.set({ sort: event.target.value === 'popularity' ? null : event.target.value })
                }
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Select
              value={url.get('release') ?? ''}
              onChange={(event) => url.set({ release: event.target.value || null })}
              className="w-44"
              aria-label="Release"
            >
              <option value="">Released or upcoming</option>
              <option value="released">Released</option>
              <option value="upcoming">Upcoming</option>
            </Select>
            {filtering ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => url.set(Object.fromEntries(FILTER_KEYS.map((key) => [key, null])))}
              >
                <X aria-hidden />
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {filtering ? (
        <DiscoverResults filters={filters} onPage={setPage} />
      ) : list === 'for-you' ? (
        <ForYou />
      ) : (
        <ListResults list={list} page={url.page} onPage={setPage} />
      )}
    </div>
  );
}
