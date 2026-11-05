import type { MovieNightCriteria } from '../database/schema/movie-nights.js';
import { certificationsUpTo } from '../movies/certifications.js';

/** What the shortlist algorithm knows about one possible movie. */
export interface SuggestionInput {
  movieId: string;
  tmdbId: number;
  title: string;
  genreIds: number[];
  voteAverage: number | null;
  runtime: number | null;
  certifications: Record<string, string>;
  inGroupWatchlist: boolean;
  /** Participants who have the movie on their personal watchlist. */
  wantedBy: number;
  /** Participants who have already watched it. */
  watchedBy: number;
}

export interface RankedSuggestion extends SuggestionInput {
  score: number;
  reasons: string[];
}

/** Keeps the movies that satisfy the criteria. */
export function matchesCriteria(
  movie: SuggestionInput,
  criteria: MovieNightCriteria,
  participantCount: number,
): boolean {
  if (criteria.genreIds?.length && !movie.genreIds.some((id) => criteria.genreIds!.includes(id)))
    return false;
  if (criteria.minRating !== undefined && (movie.voteAverage ?? -1) < criteria.minRating)
    return false;
  if (
    criteria.maxRuntime !== undefined &&
    (movie.runtime === null || movie.runtime > criteria.maxRuntime)
  ) {
    return false;
  }
  if (criteria.maxCertification) {
    const country = (criteria.certificationCountry ?? 'US').toUpperCase();
    const allowed = certificationsUpTo(country, criteria.maxCertification) ?? [
      criteria.maxCertification,
    ];
    const rating = movie.certifications[country];
    // Unknown age ratings are excluded when an age limit is set (safer for children).
    if (!rating || !allowed.includes(rating)) return false;
  }
  switch (criteria.excludeWatchedBy ?? 'all') {
    case 'any':
      if (movie.watchedBy > 0) return false;
      break;
    case 'all':
      if (participantCount > 0 && movie.watchedBy >= participantCount) return false;
      break;
    case 'none':
      break;
  }
  return true;
}

/**
 * Shortlist for a movie night: filters by the criteria, then prefers movies that many
 * participants want to see, that are on the group watchlist and that are well rated.
 */
export function rankSuggestions(
  movies: SuggestionInput[],
  criteria: MovieNightCriteria,
  participantCount: number,
): RankedSuggestion[] {
  return movies
    .filter((movie) => matchesCriteria(movie, criteria, participantCount))
    .map((movie) => {
      const reasons: string[] = [];
      if (movie.inGroupWatchlist) reasons.push('On the group watchlist');
      if (movie.wantedBy > 0) {
        reasons.push(`${movie.wantedBy} of ${participantCount} want to watch it`);
      }
      if (movie.watchedBy === 0) reasons.push('Nobody has seen it yet');
      const score =
        movie.wantedBy * 2 +
        (movie.inGroupWatchlist ? 3 : 0) +
        (movie.voteAverage ?? 5) / 2 -
        movie.watchedBy;
      return { ...movie, score: Math.round(score * 100) / 100, reasons };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.voteAverage ?? 0) - (a.voteAverage ?? 0) ||
        a.title.localeCompare(b.title),
    );
}

export interface TallyEntry {
  movieId: string;
  votes: number;
}

export function tallyVotes(
  candidateMovieIds: string[],
  votes: { movieId: string }[],
): TallyEntry[] {
  const counts = new Map(candidateMovieIds.map((id) => [id, 0]));
  for (const vote of votes) {
    if (counts.has(vote.movieId)) counts.set(vote.movieId, (counts.get(vote.movieId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([movieId, count]) => ({ movieId, votes: count }))
    .sort((a, b) => b.votes - a.votes);
}

/**
 * The winner of a vote. On a tie the organiser's `tieBreaker` wins if it is among the leaders,
 * otherwise one of the leaders is picked at random. Returns null when nobody voted.
 */
export function decideWinner(
  tally: TallyEntry[],
  tieBreaker?: string,
  random: () => number = Math.random,
): { movieId: string; tied: boolean } | null {
  const top = tally[0]?.votes ?? 0;
  if (top === 0) return null;
  const leaders = tally.filter((entry) => entry.votes === top).map((entry) => entry.movieId);
  if (leaders.length === 1) return { movieId: leaders[0]!, tied: false };
  if (tieBreaker && leaders.includes(tieBreaker)) return { movieId: tieBreaker, tied: true };
  return { movieId: leaders[Math.floor(random() * leaders.length)]!, tied: true };
}

export function pickRandom<T>(items: T[], random: () => number = Math.random): T | undefined {
  return items.length === 0 ? undefined : items[Math.floor(random() * items.length)];
}
