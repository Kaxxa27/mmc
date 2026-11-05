import type { LibraryEntry, MovieWithRuntime } from './api/types';

/** A catalog entry as a movie card (its user state comes from the entry itself). */
export function entryToMovie(entry: LibraryEntry): MovieWithRuntime {
  return {
    ...entry.movie,
    userState: {
      status: entry.status,
      isFavorite: entry.isFavorite,
      rating: entry.rating,
      lastWatchedOn: entry.lastWatchedOn,
    },
  };
}
