import type { movies } from '../database/schema/index.js';
import type { MovieStatus } from '../database/schema/enums.js';

export type MovieRow = typeof movies.$inferSelect;

export type DataSource = 'tmdb' | 'local';

export interface GenreRef {
  id: number;
  name: string;
}

/** The signed-in user's relationship with a movie. */
export interface UserMovieState {
  status: MovieStatus | null;
  isFavorite: boolean;
  rating: number | null;
  lastWatchedOn: string | null;
}

export interface MovieSummary {
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  genres: GenreRef[];
  posterPath: string | null;
  posterUrl: string | null;
  backdropPath: string | null;
  backdropUrl: string | null;
  /** Average rating on TMDB (0-10). */
  voteAverage: number | null;
  voteCount: number | null;
  popularity: number | null;
  /** Present for signed-in users: `null` when the movie is not in their catalog. */
  userState?: UserMovieState | null;
}

export interface MovieListResult {
  items: MovieSummary[];
  page: number;
  totalPages: number;
  totalResults: number;
  /** `tmdb` = live TMDB data, `local` = offline sample / previously saved movies. */
  source: DataSource;
}

export interface PersonRef {
  tmdbId: number;
  name: string;
  profileUrl: string | null;
}

export interface CastMember extends PersonRef {
  character: string | null;
  order: number;
}

export interface CrewMember extends PersonRef {
  job: string;
}

export interface MovieCrew {
  directors: CrewMember[];
  writers: CrewMember[];
  producers: CrewMember[];
  cinematographers: CrewMember[];
  composers: CrewMember[];
  editors: CrewMember[];
}

export interface MovieVideo {
  key: string;
  name: string;
  type: string;
  site: 'YouTube';
  official: boolean;
  url: string;
  embedUrl: string;
  publishedAt: string | null;
}

export interface WatchProvider {
  providerId: number;
  name: string;
  logoUrl: string | null;
}

export interface WatchAvailability {
  region: string;
  /** TMDB page listing every legal option, with links to the providers. */
  link: string | null;
  subscription: WatchProvider[];
  free: WatchProvider[];
  ads: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
  attribution: string;
  checkedAt: string;
}

export interface MovieDetails extends MovieSummary {
  imdbId: string | null;
  tagline: string | null;
  runtime: number | null;
  releaseStatus: string | null;
  originalLanguage: string | null;
  productionCountries: { code: string; name: string }[];
  spokenLanguages: { code: string; name: string }[];
  /** Certification for the requested region, e.g. `PG-13`. */
  certification: string | null;
  certifications: Record<string, string>;
  alternativeTitles: string[];
  cast: CastMember[];
  crew: MovieCrew;
  videos: MovieVideo[];
  similar: MovieSummary[];
  recommendations: MovieSummary[];
  /** `null` when no streaming information is available for the region. */
  watchProviders: WatchAvailability | null;
  source: DataSource;
}

export interface PersonSummary extends PersonRef {
  knownForDepartment: string | null;
  knownFor: string[];
}

export interface PersonMovieCredit extends MovieSummary {
  character?: string | null;
  job?: string;
}

export interface PersonDetails extends PersonSummary {
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  alsoKnownAs: string[];
  acting: PersonMovieCredit[];
  directing: PersonMovieCredit[];
  writing: PersonMovieCredit[];
  producing: PersonMovieCredit[];
}
