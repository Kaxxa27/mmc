'use client';

import { Dices, Film, Plus, Search, Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { GRID_CLASS, MovieGridSkeleton } from '@/components/movies/movie-grid';
import { MoviePickerDialog } from '@/components/movies/movie-picker-dialog';
import { Poster } from '@/components/movies/poster';
import { RandomPickDialog } from '@/components/movies/random-pick-dialog';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { EmptyState, ErrorState } from '@/components/ui/misc';
import { Pagination } from '@/components/ui/pagination';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { GroupDetails, GroupMovieStatus, GroupMovieView } from '@/lib/api/types';
import { MOVIE_STATUS_META } from '@/lib/constants';
import { useGenres } from '@/lib/queries/core';
import {
  type GroupMovieQuery,
  pickRandomGroupMovie,
  useAddGroupMovie,
  useGroupMovies,
} from '@/lib/queries/groups';
import { cn, formatDate } from '@/lib/utils';

const SORTS: { value: NonNullable<GroupMovieQuery['sort']>; label: string }[] = [
  { value: 'added_desc', label: 'Recently added' },
  { value: 'added_asc', label: 'Oldest added' },
  { value: 'title_asc', label: 'Title A–Z' },
  { value: 'release_desc', label: 'Newest releases' },
  { value: 'group_rating_desc', label: 'Group rating' },
  { value: 'tmdb_rating_desc', label: 'TMDB rating' },
];

function MemberDots({ entry }: { entry: GroupMovieView }) {
  const watched = entry.members.filter((member) => member.status === 'watched').length;
  const wants = entry.members.filter((member) => member.status === 'want_to_watch').length;
  return (
    <span className="flex items-center gap-2">
      <span className="flex -space-x-1">
        {entry.members.slice(0, 5).map((member) => (
          <span
            key={member.userId}
            title={`${member.displayName}: ${member.status ? MOVIE_STATUS_META[member.status].label : 'no status'}`}
            className={cn(
              'size-3 rounded-full ring-2 ring-card',
              member.status ? MOVIE_STATUS_META[member.status].dot : 'bg-muted-foreground/30',
            )}
          />
        ))}
      </span>
      <span>
        {watched ? `${watched} seen` : ''}
        {watched && wants ? ' · ' : ''}
        {wants ? `${wants} want` : ''}
      </span>
    </span>
  );
}

function GroupMovieCard({ groupId, entry }: { groupId: string; entry: GroupMovieView }) {
  const href = `/groups/${groupId}/movies/${entry.movie.tmdbId}`;
  return (
    <Link href={href} className="group flex min-w-0 flex-col">
      <div className="relative">
        <Poster
          src={entry.movie.posterUrl}
          title={entry.movie.title}
          className="shadow-sm ring-1 ring-black/5 transition group-hover:-translate-y-0.5 group-hover:shadow-lg dark:ring-white/10"
        />
        <span
          className={cn(
            'absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm',
            entry.status === 'watched' ? 'bg-emerald-600/85' : 'bg-black/55',
          )}
        >
          {entry.status === 'watched' ? 'Watched together' : 'Want to watch'}
        </span>
        {entry.groupRating.average !== null ? (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
            <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
            {entry.groupRating.average.toFixed(1)}
          </span>
        ) : null}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug group-hover:underline">
        {entry.movie.title}
      </p>
      <div className="mt-1 text-xs text-muted-foreground">
        <MemberDots entry={entry} />
        {entry.status === 'watched' && entry.watchedOn ? (
          <p className="mt-0.5">on {formatDate(entry.watchedOn)}</p>
        ) : null}
      </div>
    </Link>
  );
}

export function GroupCatalog({ group }: { group: GroupDetails }) {
  const { data: genres } = useGenres();
  const [status, setStatus] = useState<GroupMovieStatus | ''>('');
  const [genreId, setGenreId] = useState('');
  const [sort, setSort] = useState<NonNullable<GroupMovieQuery['sort']>>('added_desc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebouncedValue(search.trim(), 350);
  const [dialog, setDialog] = useState<'add' | 'random' | null>(null);
  const add = useAddGroupMovie();

  const { data, isPending, error, refetch, isPlaceholderData } = useGroupMovies(group.id, {
    status: status || undefined,
    genreIds: genreId ? [Number(genreId)] : undefined,
    query: query || undefined,
    sort,
    page,
    pageSize: 30,
  });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search the group catalog…"
            className="pl-9"
            aria-label="Search the group catalog"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as GroupMovieStatus | '');
              setPage(1);
            }}
            className="w-40"
            aria-label="Status"
          >
            <option value="">All movies</option>
            <option value="want_to_watch">Want to watch</option>
            <option value="watched">Watched together</option>
          </Select>
          <Select
            value={genreId}
            onChange={(event) => {
              setGenreId(event.target.value);
              setPage(1);
            }}
            className="w-36"
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
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as typeof sort);
              setPage(1);
            }}
            className="w-40"
            aria-label="Sort"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={() => setDialog('random')}>
            <Dices aria-hidden />
            Random
          </Button>
          {!group.archived ? (
            <Button onClick={() => setDialog('add')}>
              <Plus aria-hidden />
              Add movie
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <MovieGridSkeleton count={10} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Film}
          title={query || status || genreId ? 'No movies match' : 'The group catalog is empty'}
          description="Add movies the group wants to watch together. Everyone can add, rate and comment."
          action={
            !group.archived && !query ? (
              <Button onClick={() => setDialog('add')}>
                <Plus aria-hidden />
                Add the first movie
              </Button>
            ) : null
          }
        />
      ) : (
        <div className={cn(isPlaceholderData && 'opacity-70 transition-opacity')}>
          <div className={GRID_CLASS}>
            {data.items.map((entry) => (
              <GroupMovieCard key={entry.movie.tmdbId} groupId={group.id} entry={entry} />
            ))}
          </div>
          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}

      {dialog === 'add' ? (
        <MoviePickerDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={`Add to ${group.name}`}
          description="Movies the group wants to watch together."
          onPick={(movie) => add.mutateAsync({ groupId: group.id, tmdbId: movie.tmdbId })}
        />
      ) : null}
      <RandomPickDialog
        open={dialog === 'random'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="What should we watch?"
        description={`A random pick from ${group.name}'s “want to watch” list.`}
        movieHref={(movie) => `/groups/${group.id}/movies/${movie.tmdbId}`}
        pick={async (filters) =>
          (await pickRandomGroupMovie(group.id, { status: 'want_to_watch', ...filters })).movie
        }
      />
    </div>
  );
}
