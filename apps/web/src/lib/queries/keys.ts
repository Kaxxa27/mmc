/** Query key roots. Mutations invalidate by root so every dependent view refreshes. */
export const keys = {
  me: ['me'] as const,
  config: ['config'] as const,
  genres: ['genres'] as const,
  home: ['home'] as const,
  movies: ['movies'] as const,
  movie: ['movie'] as const,
  people: ['people'] as const,
  library: ['library'] as const,
  reviews: ['reviews'] as const,
  collections: ['collections'] as const,
  groups: ['groups'] as const,
  movieNights: ['movie-nights'] as const,
  notifications: ['notifications'] as const,
  calendar: ['calendar'] as const,
  recommendations: ['recommendations'] as const,
  sessions: ['sessions'] as const,
  invitations: ['invitations'] as const,
};

/** Everything that shows a user's status for movies (cards, lists, details). */
export const MOVIE_STATE_KEYS = [
  keys.library,
  keys.movies,
  keys.movie,
  keys.home,
  keys.recommendations,
  keys.groups,
  keys.collections,
  keys.movieNights,
  keys.calendar,
];
