'use client';

import {
  Clapperboard,
  Dices,
  Ellipsis,
  Heart,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';
import { MovieActionsMenu } from '@/components/movies/movie-actions';
import { MovieGrid, MovieGridSkeleton } from '@/components/movies/movie-grid';
import { Poster } from '@/components/movies/poster';
import { RandomPickDialog } from '@/components/movies/random-pick-dialog';
import { StatusBadge } from '@/components/movies/status-badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { EmptyState, ErrorState } from '@/components/ui/misc';
import { Pagination } from '@/components/ui/pagination';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useUrlState } from '@/hooks/use-url-state';
import type { LibraryEntry, MovieStatus } from '@/lib/api/types';
import { MOVIE_STATUS_META, MOVIE_STATUSES } from '@/lib/constants';
import { entryToMovie } from '@/lib/movies';
import { useGenres } from '@/lib/queries/core';
import {
  type LibraryQuery,
  type LibrarySort,
  pickRandomFromLibrary,
  useLibrary,
} from '@/lib/queries/library';
import { cn, formatDate, formatRuntime } from '@/lib/utils';

const SORTS: { value: LibrarySort; label: string }[] = [
  { value: 'added_desc', label: 'Recently added' },
  { value: 'added_asc', label: 'Oldest added' },
  { value: 'title_asc', label: 'Title A–Z' },
  { value: 'title_desc', label: 'Title Z–A' },
  { value: 'release_desc', label: 'Newest releases' },
  { value: 'release_asc', label: 'Oldest releases' },
  { value: 'rating_desc', label: 'My rating: high to low' },
  { value: 'rating_asc', label: 'My rating: low to high' },
  { value: 'tmdb_rating_desc', label: 'TMDB rating' },
  { value: 'popularity_desc', label: 'Popularity' },
  { value: 'watched_desc', label: 'Recently watched' },
  { value: 'runtime_asc', label: 'Shortest first' },
  { value: 'runtime_desc', label: 'Longest first' },
];

const EXTRA_FILTERS = ['from', 'to', 'minr', 'maxr', 'runtime'];

function EntryFooter({ entry }: { entry: LibraryEntry }) {
  const parts: ReactNode[] = [];
  if (entry.lastWatchedOn) parts.push(`Watched ${formatDate(entry.lastWatchedOn)}`);
  else parts.push(`Added ${formatDate(entry.addedAt)}`);
  return <span>{parts}</span>;
}

function EntryRow({ entry }: { entry: LibraryEntry }) {
  const movie = entryToMovie(entry);
  return (
    <li className="flex items-center gap-4 py-3">
      <Link href={`/movies/${movie.tmdbId}`} className="shrink-0">
        <Poster src={movie.posterUrl} title={movie.title} className="w-14 rounded-lg" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/movies/${movie.tmdbId}`} className="font-medium hover:underline">
          {movie.title}
        </Link>
        <p className="text-xs text-muted-foreground">
          {[
            movie.releaseYear,
            formatRuntime(movie.runtime),
            movie.genres
              .slice(0, 3)
              .map((g) => g.name)
              .join(', '),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {entry.status ? <StatusBadge status={entry.status} /> : null}
          {entry.isFavorite ? (
            <Heart className="size-4 fill-rose-500 text-rose-500" aria-label="Favorite" />
          ) : null}
          {entry.rating ? <span className="text-xs font-medium">★ {entry.rating}/10</span> : null}
          {entry.watchCount > 1 ? (
            <span className="text-xs text-muted-foreground">watched {entry.watchCount}×</span>
          ) : null}
        </div>
        {entry.notes ? (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">📝 {entry.notes}</p>
        ) : null}
      </div>
      <div className="hidden text-right text-xs text-muted-foreground sm:block">
        <EntryFooter entry={entry} />
      </div>
      <MovieActionsMenu
        movie={movie}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${movie.title}`}>
            <Ellipsis aria-hidden />
          </Button>
        }
      />
    </li>
  );
}

export function LibraryBrowser({
  fixedStatus,
  emptyTitle,
  emptyDescription,
  randomTitle = 'What should I watch?',
  headerActions,
}: {
  /** Lock the status filter (e.g. the watchlist). */
  fixedStatus?: MovieStatus[];
  emptyTitle: string;
  emptyDescription: ReactNode;
  randomTitle?: string;
  headerActions?: (openRandom: () => void) => ReactNode;
}) {
  const url = useUrlState();
  const { set } = url;
  const { data: genres } = useGenres();
  const [search, setSearch] = useState(url.get('q') ?? '');
  const debounced = useDebouncedValue(search.trim(), 350);
  const [showMore, setShowMore] = useState(() =>
    EXTRA_FILTERS.some((key) => url.searchParams.has(key)),
  );
  const [randomOpen, setRandomOpen] = useState(false);
  const view = url.get('view') === 'list' ? 'list' : 'grid';

  useEffect(() => {
    const current = new URLSearchParams(window.location.search).get('q') ?? '';
    if (debounced !== current) set({ q: debounced || null });
  }, [debounced, set]);

  const statuses = (fixedStatus ?? (url.getList('status') as MovieStatus[])).filter((s) =>
    MOVIE_STATUSES.includes(s),
  );
  const genreId = url.getNumber('genre');
  const query: LibraryQuery = {
    status: statuses.length ? statuses : undefined,
    favorite: url.get('favorite') === 'true' ? true : undefined,
    genreIds: genreId ? [genreId] : undefined,
    yearFrom: url.getNumber('from'),
    yearTo: url.getNumber('to'),
    minRating: url.getNumber('minr'),
    maxRating: url.getNumber('maxr'),
    maxRuntime: url.getNumber('runtime'),
    query: url.get('q'),
    sort: (url.get('sort') as LibrarySort | undefined) ?? 'added_desc',
    page: url.page,
    pageSize: 30,
  };
  const { data, isPending, error, refetch, isPlaceholderData } = useLibrary(query);
  const filtered =
    Boolean(query.query) ||
    (!fixedStatus && statuses.length > 0) ||
    query.favorite ||
    Boolean(genreId) ||
    EXTRA_FILTERS.some((key) => url.searchParams.has(key));

  function toggleStatus(status: MovieStatus) {
    const next = statuses.includes(status)
      ? statuses.filter((s) => s !== status)
      : [...statuses, status];
    set({ status: next });
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your movies…"
            className="pl-9"
            aria-label="Search your movies"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={genreId ?? ''}
            onChange={(event) => set({ genre: event.target.value || null })}
            className="w-40"
            aria-label="Genre"
          >
            <option value="">All genres</option>
            {(genres ?? []).map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
              </option>
            ))}
          </Select>
          <Select
            value={query.sort}
            onChange={(event) =>
              set({ sort: event.target.value === 'added_desc' ? null : event.target.value })
            }
            className="w-48"
            aria-label="Sort"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button
            variant={showMore ? 'secondary' : 'outline'}
            size="icon"
            aria-label="More filters"
            aria-pressed={showMore}
            onClick={() => setShowMore((value) => !value)}
          >
            <SlidersHorizontal aria-hidden />
          </Button>
          <div className="flex rounded-lg border p-0.5">
            <Button
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              size="icon-sm"
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => set({ view: null }, { keepPage: true })}
            >
              <LayoutGrid aria-hidden />
            </Button>
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="icon-sm"
              aria-label="List view"
              aria-pressed={view === 'list'}
              onClick={() => set({ view: 'list' }, { keepPage: true })}
            >
              <List aria-hidden />
            </Button>
          </div>
          {headerActions ? (
            headerActions(() => setRandomOpen(true))
          ) : (
            <Button variant="outline" onClick={() => setRandomOpen(true)}>
              <Dices aria-hidden />
              Random
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {!fixedStatus
          ? MOVIE_STATUSES.map((status) => {
              const meta = MOVIE_STATUS_META[status];
              const active = statuses.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleStatus(status)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                    active ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted',
                  )}
                >
                  <span className={cn('size-2 rounded-full', meta.dot)} aria-hidden />
                  {meta.label}
                </button>
              );
            })
          : null}
        <button
          type="button"
          aria-pressed={query.favorite === true}
          onClick={() => set({ favorite: query.favorite ? null : 'true' })}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
            query.favorite ? 'border-rose-500 bg-rose-500 text-white' : 'hover:bg-muted',
          )}
        >
          <Heart className={cn('size-3.5', query.favorite && 'fill-white')} aria-hidden />
          Favorites
        </button>
        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              set({
                q: null,
                status: null,
                favorite: null,
                genre: null,
                from: null,
                to: null,
                minr: null,
                maxr: null,
                runtime: null,
              });
            }}
          >
            <X aria-hidden />
            Clear
          </Button>
        ) : null}
        {!fixedStatus && !statuses.includes('not_interested') ? (
          <span className="text-xs text-muted-foreground">
            “Not interested” movies are hidden unless selected.
          </span>
        ) : null}
      </div>

      {showMore ? (
        <div className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-5">
          <Field label="From year" htmlFor="l-from">
            <Input
              id="l-from"
              key={`from-${url.get('from') ?? ''}`}
              type="number"
              min={1870}
              max={2100}
              defaultValue={url.get('from')}
              onBlur={(event) => set({ from: event.target.value || null })}
            />
          </Field>
          <Field label="To year" htmlFor="l-to">
            <Input
              id="l-to"
              key={`to-${url.get('to') ?? ''}`}
              type="number"
              min={1870}
              max={2100}
              defaultValue={url.get('to')}
              onBlur={(event) => set({ to: event.target.value || null })}
            />
          </Field>
          <Field label="My rating from" htmlFor="l-minr">
            <Select
              id="l-minr"
              value={url.get('minr') ?? ''}
              onChange={(event) => set({ minr: event.target.value || null })}
            >
              <option value="">Any</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="My rating to" htmlFor="l-maxr">
            <Select
              id="l-maxr"
              value={url.get('maxr') ?? ''}
              onChange={(event) => set({ maxr: event.target.value || null })}
            >
              <option value="">Any</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Max. length" htmlFor="l-runtime">
            <Select
              id="l-runtime"
              value={url.get('runtime') ?? ''}
              onChange={(event) => set({ runtime: event.target.value || null })}
            >
              <option value="">Any</option>
              <option value="90">1h 30m</option>
              <option value="120">2h</option>
              <option value="150">2h 30m</option>
              <option value="180">3h</option>
            </Select>
          </Field>
        </div>
      ) : null}

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <MovieGridSkeleton count={12} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title={filtered ? 'No movies match these filters' : emptyTitle}
          description={filtered ? 'Try removing a filter.' : emptyDescription}
          action={
            filtered ? null : (
              <Button asChild>
                <Link href="/discover">Discover movies</Link>
              </Button>
            )
          }
        />
      ) : (
        <div className={cn(isPlaceholderData && 'opacity-70 transition-opacity')}>
          <p className="mb-4 text-sm text-muted-foreground">
            {data.total} {data.total === 1 ? 'movie' : 'movies'}
          </p>
          {view === 'grid' ? (
            <MovieGrid
              movies={data.items.map(entryToMovie)}
              footer={(movie) => {
                const entry = data.items.find((item) => item.movie.tmdbId === movie.tmdbId);
                return entry ? <EntryFooter entry={entry} /> : null;
              }}
            />
          ) : (
            <ul className="divide-y rounded-2xl border bg-card px-4">
              {data.items.map((entry) => (
                <EntryRow key={entry.movie.tmdbId} entry={entry} />
              ))}
            </ul>
          )}
          <Pagination
            page={url.page}
            totalPages={data.totalPages}
            onChange={(page) => {
              set({ page }, { keepPage: true });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}

      <RandomPickDialog
        open={randomOpen}
        onOpenChange={setRandomOpen}
        title={randomTitle}
        description={
          fixedStatus ? 'A random movie from this list.' : 'A random movie from your watchlist.'
        }
        pick={async (filters) =>
          (
            await pickRandomFromLibrary({
              status: fixedStatus ?? ['want_to_watch'],
              favorite: query.favorite,
              ...filters,
            })
          ).movie
        }
      />
    </div>
  );
}
