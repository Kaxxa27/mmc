import type { MovieStatus } from '../database/schema/enums.js';
import type { MovieSummary } from '../movies/movie.types.js';

export interface LibraryMovie extends MovieSummary {
  runtime: number | null;
}

export interface LibraryEntry {
  movie: LibraryMovie;
  status: MovieStatus | null;
  isFavorite: boolean;
  /** Personal rating 1-10 (independent of the TMDB rating). */
  rating: number | null;
  /** Private notes, visible only to the owner. */
  notes: string | null;
  lastWatchedOn: string | null;
  watchCount: number;
  addedAt: Date;
  updatedAt: Date;
}

export interface WatchEventView {
  id: string;
  movie: LibraryMovie;
  watchedOn: string;
  rating: number | null;
  notes: string | null;
  isRewatch: boolean;
  movieNightId: string | null;
  createdAt: Date;
}

export type DefaultListKey =
  'watchlist' | 'watching' | 'watched' | 'favorites' | 'highest_rated' | 'recently_added';

export interface DefaultList {
  key: DefaultListKey;
  name: string;
  count: number;
  /** Query parameters for `GET /me/movies` that return this list. */
  query: Record<string, string>;
  preview: LibraryMovie[];
}

export interface LibraryStats {
  totals: {
    inCatalog: number;
    watched: number;
    wantToWatch: number;
    watching: number;
    notInterested: number;
    favorites: number;
    rated: number;
    reviews: number;
    viewings: number;
  };
  averageRating: number | null;
  totalWatchTimeMinutes: number;
  topGenres: { id: number; name: string; count: number }[];
  /** Viewings per month for the last 12 months (oldest first). */
  viewingsByMonth: { month: string; count: number }[];
  /** The three months with the most viewings ever. */
  mostActiveMonths: { month: string; count: number }[];
}
