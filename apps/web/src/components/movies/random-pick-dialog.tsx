'use client';

import { Dices, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/form';
import { ApiError, errorMessage } from '@/lib/api/client';
import type { MovieWithRuntime } from '@/lib/api/types';
import { useGenres } from '@/lib/queries/core';
import { formatRuntime } from '@/lib/utils';
import { Poster } from './poster';
import { TmdbRating } from './status-badge';

export interface RandomFilters {
  genreIds?: number[];
  maxRuntime?: number;
}

const RUNTIMES = [
  { value: '', label: 'Any length' },
  { value: '90', label: 'Up to 1h 30m' },
  { value: '120', label: 'Up to 2h' },
  { value: '150', label: 'Up to 2h 30m' },
];

/** "What should we watch?" — a random pick from a list, with optional genre and length filters. */
export function RandomPickDialog({
  open,
  onOpenChange,
  title,
  description,
  pick,
  movieHref = (movie) => `/movies/${movie.tmdbId}`,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  pick: (filters: RandomFilters) => Promise<MovieWithRuntime>;
  movieHref?: (movie: MovieWithRuntime) => string;
}) {
  const { data: genres } = useGenres();
  const [genreId, setGenreId] = useState('');
  const [maxRuntime, setMaxRuntime] = useState('');
  const [movie, setMovie] = useState<MovieWithRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function roll() {
    setPending(true);
    setError(null);
    try {
      setMovie(
        await pick({
          genreIds: genreId ? [Number(genreId)] : undefined,
          maxRuntime: maxRuntime ? Number(maxRuntime) : undefined,
        }),
      );
    } catch (err) {
      setMovie(null);
      setError(
        err instanceof ApiError && err.code === 'NO_MATCHING_MOVIES'
          ? 'No movies match these filters. Try a different genre or length.'
          : errorMessage(err),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Genre" htmlFor="random-genre">
            <Select
              id="random-genre"
              value={genreId}
              onChange={(event) => setGenreId(event.target.value)}
            >
              <option value="">Any genre</option>
              {(genres ?? []).map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Length" htmlFor="random-runtime">
            <Select
              id="random-runtime"
              value={maxRuntime}
              onChange={(event) => setMaxRuntime(event.target.value)}
            >
              {RUNTIMES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-5 min-h-48">
          {movie ? (
            <div className="flex animate-slide-up gap-4 rounded-2xl bg-muted/60 p-3">
              <Poster src={movie.posterUrl} title={movie.title} className="w-28 shrink-0" />
              <div className="min-w-0 py-1">
                <p className="text-lg font-semibold leading-tight">{movie.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  {movie.releaseYear ? <span>{movie.releaseYear}</span> : null}
                  {movie.runtime ? <span>{formatRuntime(movie.runtime)}</span> : null}
                  <TmdbRating value={movie.voteAverage} />
                </p>
                <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{movie.overview}</p>
                <Button asChild variant="link" size="sm" className="mt-2">
                  <Link href={movieHref(movie)} onClick={() => onOpenChange(false)}>
                    Open movie
                    <ExternalLink aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          ) : error ? (
            <p className="rounded-2xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
              {error}
            </p>
          ) : (
            <p className="rounded-2xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
              Can&apos;t decide? Let chance pick for you.
            </p>
          )}
        </div>

        <Button size="lg" className="mt-5 w-full" loading={pending} onClick={() => void roll()}>
          <Dices aria-hidden />
          {movie ? 'Pick another' : 'Pick a movie'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
