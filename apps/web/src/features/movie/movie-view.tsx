'use client';

import { ExternalLink, LogIn } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { MovieRow } from '@/components/movies/movie-row';
import { Backdrop, Poster } from '@/components/movies/poster';
import { TmdbRating } from '@/components/movies/status-badge';
import { Button } from '@/components/ui/button';
import { Badge, ErrorState, Skeleton } from '@/components/ui/misc';
import { ApiError } from '@/lib/api/client';
import type { MovieDetails } from '@/lib/api/types';
import { useMe } from '@/lib/queries/core';
import { useMovie } from '@/lib/queries/movies';
import { formatDate, formatRuntime } from '@/lib/utils';
import { CastList, CrewList } from './people-list';
import { ReviewsSection } from './reviews-section';
import { Trailer } from './trailer';
import { UserPanel } from './user-panel';
import { WatchProviders } from './watch-providers';

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="min-w-0 scroll-mt-20">
      <h2 className="mb-4 text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Facts({ movie }: { movie: MovieDetails }) {
  const facts: [string, ReactNode][] = [];
  if (movie.originalTitle && movie.originalTitle !== movie.title)
    facts.push(['Original title', movie.originalTitle]);
  if (movie.releaseStatus) facts.push(['Status', movie.releaseStatus]);
  if (movie.releaseDate) facts.push(['Release date', formatDate(movie.releaseDate)]);
  if (movie.originalLanguage)
    facts.push(['Original language', movie.originalLanguage.toUpperCase()]);
  if (movie.spokenLanguages.length)
    facts.push(['Spoken languages', movie.spokenLanguages.map((l) => l.name).join(', ')]);
  if (movie.productionCountries.length)
    facts.push(['Countries', movie.productionCountries.map((c) => c.name).join(', ')]);
  const certifications = Object.entries(movie.certifications);
  if (certifications.length) {
    facts.push([
      'Age ratings',
      certifications.map(([country, value]) => `${country}: ${value}`).join(' · '),
    ]);
  }
  if (movie.alternativeTitles.length)
    facts.push(['Also known as', movie.alternativeTitles.slice(0, 6).join(' · ')]);
  if (movie.imdbId) {
    facts.push([
      'IMDb',
      <a
        key="imdb"
        href={`https://www.imdb.com/title/${movie.imdbId}/`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 underline underline-offset-2"
      >
        {movie.imdbId}
        <ExternalLink className="size-3" aria-hidden />
      </a>,
    ]);
  }
  return (
    <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </dt>
          <dd className="mt-0.5">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MovieSkeleton() {
  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <Skeleton className="aspect-[2/3] w-48 rounded-xl md:w-64" />
      <div className="flex-1 space-y-4 py-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full max-w-2xl" />
      </div>
    </div>
  );
}

export function MovieView({ tmdbId }: { tmdbId: number }) {
  const { data: me } = useMe();
  const { data: movie, isPending, error, refetch } = useMovie(tmdbId);
  const [reviewOpen, setReviewOpen] = useState(false);

  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <ErrorState error={new Error('This movie does not exist or was removed from TMDB.')} />
      );
    }
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }
  if (isPending) return <MovieSkeleton />;

  const trailer = movie.videos.find((video) => video.type === 'Trailer') ?? movie.videos[0];
  const directors = movie.crew.directors.slice(0, 3);

  return (
    <div className="flex flex-col gap-12">
      <div className="relative -mx-4 -mt-6 overflow-hidden sm:-mx-6 lg:-mx-10">
        <Backdrop src={movie.backdropUrl} className="absolute inset-0 size-full opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
        <div className="relative flex flex-col gap-8 px-4 pb-6 pt-8 sm:px-6 md:flex-row md:pt-12 lg:px-10">
          <Poster
            src={movie.posterUrl}
            title={movie.title}
            priority
            className="w-44 shrink-0 self-start shadow-2xl sm:w-56 md:w-64"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {movie.title}{' '}
              {movie.releaseYear ? (
                <span className="font-normal text-muted-foreground">({movie.releaseYear})</span>
              ) : null}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              {movie.certification ? (
                <Badge className="border border-current bg-transparent">
                  {movie.certification}
                </Badge>
              ) : null}
              {movie.releaseDate ? <span>{formatDate(movie.releaseDate)}</span> : null}
              {movie.runtime ? <span>{formatRuntime(movie.runtime)}</span> : null}
              {movie.genres.length ? (
                <span>{movie.genres.map((genre) => genre.name).join(', ')}</span>
              ) : null}
              <TmdbRating value={movie.voteAverage} className="text-foreground" />
              {movie.voteCount ? (
                <span className="text-xs">({movie.voteCount.toLocaleString('en-US')} votes)</span>
              ) : null}
            </div>
            {movie.tagline ? (
              <p className="mt-4 italic text-muted-foreground">“{movie.tagline}”</p>
            ) : null}
            {movie.overview ? (
              <p className="mt-3 max-w-3xl leading-relaxed">{movie.overview}</p>
            ) : null}
            {directors.length ? (
              <p className="mt-4 text-sm">
                <span className="text-muted-foreground">Directed by </span>
                {directors.map((director, index) => (
                  <span key={director.tmdbId}>
                    {index > 0 ? ', ' : null}
                    <Link
                      href={`/people/${director.tmdbId}`}
                      className="font-medium hover:underline"
                    >
                      {director.name}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}

            <div className="mt-6">
              {me ? (
                <UserPanel movie={movie} onWriteReview={() => setReviewOpen(true)} />
              ) : me === null ? (
                <Button asChild>
                  <Link href={`/sign-in?next=${encodeURIComponent(`/movies/${tmdbId}`)}`}>
                    <LogIn aria-hidden />
                    Sign in to save, rate and review
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-12">
          {trailer ? (
            <Section title="Trailer">
              <div className="max-w-3xl">
                <Trailer video={trailer} />
              </div>
            </Section>
          ) : null}
          <Section title="Cast">
            <CastList cast={movie.cast} />
          </Section>
          <Section title="Crew">
            <CrewList crew={movie.crew} />
          </Section>
          <Section title="Reviews" id="reviews">
            <ReviewsSection
              tmdbId={tmdbId}
              title={movie.title}
              signedIn={Boolean(me)}
              myRating={movie.userState?.rating ?? null}
              dialogOpen={reviewOpen}
              onDialogOpenChange={setReviewOpen}
            />
          </Section>
        </div>
        <aside className="flex flex-col gap-12">
          <Section title="Where to watch">
            <WatchProviders availability={movie.watchProviders} />
          </Section>
          <Section title="Details">
            <Facts movie={movie} />
          </Section>
        </aside>
      </div>

      <MovieRow title="Recommended" movies={movie.recommendations} />
      <MovieRow title="Similar movies" movies={movie.similar} />
    </div>
  );
}
