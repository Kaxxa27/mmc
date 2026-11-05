'use client';

import { Check, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/form';
import { Spinner } from '@/components/ui/misc';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { MovieSummary } from '@/lib/api/types';
import { useMovieSearch } from '@/lib/queries/movies';
import { Poster } from './poster';

/**
 * Search TMDB and pick movies one by one (adding to a collection, a group catalog,
 * or movie-night candidates). `onPick` returns a promise so each row shows its own progress.
 */
export function MoviePickerDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel = 'Add',
  excludeIds = [],
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  actionLabel?: string;
  excludeIds?: number[];
  onPick: (movie: MovieSummary) => Promise<unknown>;
}) {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 350);
  const { data, isFetching, error } = useMovieSearch(debounced);
  const [picked, setPicked] = useState<number[]>([]);
  const [pending, setPending] = useState<number | null>(null);

  async function pick(movie: MovieSummary) {
    setPending(movie.tmdbId);
    try {
      await onPick(movie);
      setPicked((ids) => [...ids, movie.tmdbId]);
    } catch {
      // The mutation already showed a toast.
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} size="lg">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title…"
            className="pl-9"
            aria-label="Search movies"
          />
        </div>
        <div className="mt-4 min-h-64">
          {debounced.length < 2 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Type at least two letters to search.
            </p>
          ) : isFetching && !data ? (
            <Spinner />
          ) : error ? (
            <p className="py-16 text-center text-sm text-red-600">Search failed. Try again.</p>
          ) : data && data.items.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No movies found for “{debounced}”.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {data?.items.map((movie) => {
                const done = picked.includes(movie.tmdbId) || excludeIds.includes(movie.tmdbId);
                return (
                  <li key={movie.tmdbId} className="flex items-center gap-3 py-2">
                    <Poster
                      src={movie.posterUrl}
                      title={movie.title}
                      className="w-11 shrink-0 rounded-md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{movie.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          movie.releaseYear,
                          movie.genres
                            .slice(0, 2)
                            .map((genre) => genre.name)
                            .join(', '),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={done ? 'secondary' : 'outline'}
                      disabled={done || (pending !== null && pending !== movie.tmdbId)}
                      loading={pending === movie.tmdbId}
                      onClick={() => void pick(movie)}
                    >
                      {done ? <Check aria-hidden /> : <Plus aria-hidden />}
                      {done ? 'Added' : actionLabel}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
