/** Subset of the TMDB v3 API response shapes used by the app. */

export interface TmdbPaged<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbMovieListItem {
  id: number;
  title: string;
  original_title?: string;
  original_language?: string;
  overview?: string | null;
  release_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids?: number[];
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  adult?: boolean;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TmdbVideo {
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at?: string;
  iso_639_1?: string;
}

export interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

export interface TmdbWatchProviders {
  link: string;
  flatrate?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
  free?: TmdbProvider[];
  ads?: TmdbProvider[];
}

export interface TmdbReleaseDates {
  results: {
    iso_3166_1: string;
    release_dates: { certification: string; type: number; release_date: string }[];
  }[];
}

export interface TmdbMovieDetails {
  id: number;
  imdb_id: string | null;
  title: string;
  original_title: string;
  original_language: string;
  overview: string | null;
  tagline: string | null;
  release_date: string;
  runtime: number | null;
  status: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: TmdbGenre[];
  origin_country?: string[];
  production_countries: { iso_3166_1: string; name: string }[];
  spoken_languages: { iso_639_1: string; english_name: string; name: string }[];
  popularity: number;
  vote_average: number;
  vote_count: number;
  adult: boolean;
  homepage?: string | null;
  credits?: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] };
  videos?: { results: TmdbVideo[] };
  release_dates?: TmdbReleaseDates;
  similar?: TmdbPaged<TmdbMovieListItem>;
  recommendations?: TmdbPaged<TmdbMovieListItem>;
  'watch/providers'?: { results: Record<string, TmdbWatchProviders> };
  alternative_titles?: { titles: { iso_3166_1: string; title: string; type: string }[] };
}

export interface TmdbPersonSearchItem {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  popularity?: number;
  known_for?: { media_type?: string; title?: string; name?: string }[];
}

export interface TmdbPersonCredit extends TmdbMovieListItem {
  character?: string;
  job?: string;
  department?: string;
}

export interface TmdbPerson {
  id: number;
  name: string;
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string | null;
  also_known_as?: string[];
  movie_credits?: { cast: TmdbPersonCredit[]; crew: TmdbPersonCredit[] };
}
