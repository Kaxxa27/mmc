import { AppConfig } from '../config/app-config.js';
import type { TmdbMovieDetails } from '../tmdb/tmdb.types.js';
import type { GenresService } from './genres.service.js';
import { MoviePresenter } from './movie.presenter.js';

const config = AppConfig.fromEnvironment({
  DATABASE_URL: 'postgresql://localhost/db',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  TMDB_API_KEY: 'key',
});
const genres = {
  refs: (ids: readonly number[]) =>
    ids.map((id) => ({ id, name: { 16: 'Animation', 35: 'Comedy' }[id] ?? 'Unknown' })),
} as unknown as GenresService;
const presenter = new MoviePresenter(config, genres);

const details: TmdbMovieDetails = {
  id: 862,
  imdb_id: 'tt0114709',
  title: 'Toy Story',
  original_title: 'Toy Story',
  original_language: 'en',
  overview: 'Toys come to life.',
  tagline: '',
  release_date: '1995-11-22',
  runtime: 81,
  status: 'Released',
  poster_path: '/poster.jpg',
  backdrop_path: null,
  genres: [
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
  ],
  production_countries: [{ iso_3166_1: 'US', name: 'United States of America' }],
  spoken_languages: [{ iso_639_1: 'en', english_name: 'English', name: 'English' }],
  popularity: 101.234,
  vote_average: 7.968,
  vote_count: 18000,
  adult: false,
  credits: {
    cast: [
      { id: 2, name: 'Tim Allen', character: 'Buzz', profile_path: null, order: 1 },
      { id: 1, name: 'Tom Hanks', character: 'Woody', profile_path: '/hanks.jpg', order: 0 },
    ],
    crew: [
      {
        id: 7,
        name: 'John Lasseter',
        job: 'Director',
        department: 'Directing',
        profile_path: null,
      },
      { id: 8, name: 'Joss Whedon', job: 'Screenplay', department: 'Writing', profile_path: null },
      { id: 8, name: 'Joss Whedon', job: 'Writer', department: 'Writing', profile_path: null },
      {
        id: 9,
        name: 'Randy Newman',
        job: 'Original Music Composer',
        department: 'Sound',
        profile_path: null,
      },
      { id: 10, name: 'Someone', job: 'Gaffer', department: 'Lighting', profile_path: null },
    ],
  },
  videos: {
    results: [
      { key: 'teaser1', name: 'Teaser', site: 'YouTube', type: 'Teaser', official: true },
      { key: 'vimeo1', name: 'Trailer', site: 'Vimeo', type: 'Trailer', official: true },
      {
        key: 'trailer1',
        name: 'Official Trailer',
        site: 'YouTube',
        type: 'Trailer',
        official: true,
      },
    ],
  },
  release_dates: {
    results: [
      { iso_3166_1: 'US', release_dates: [{ certification: 'G', type: 3, release_date: '' }] },
    ],
  },
  similar: {
    page: 1,
    total_pages: 1,
    total_results: 1,
    results: [
      { id: 863, title: 'Toy Story 2', poster_path: null, backdrop_path: null, genre_ids: [16] },
    ],
  },
  'watch/providers': {
    results: {
      US: {
        link: 'https://www.themoviedb.org/movie/862/watch',
        flatrate: [
          {
            provider_id: 337,
            provider_name: 'Disney Plus',
            logo_path: '/disney.jpg',
            display_priority: 1,
          },
        ],
        rent: [{ provider_id: 2, provider_name: 'Apple TV', logo_path: null, display_priority: 4 }],
      },
    },
  },
  alternative_titles: {
    titles: [
      { iso_3166_1: 'DE', title: 'Toy Story', type: '' },
      { iso_3166_1: 'FR', title: 'Histoire de jouets', type: '' },
    ],
  },
};

describe('MoviePresenter', () => {
  it('maps TMDB details into the API shape', () => {
    const result = presenter.fromTmdbDetails(details, 'US', new Date('2026-11-04T10:00:00Z'));
    expect(result).toMatchObject({
      tmdbId: 862,
      releaseYear: 1995,
      runtime: 81,
      tagline: null,
      voteAverage: 8,
      popularity: 101.2,
      certification: 'G',
      posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      backdropUrl: null,
      alternativeTitles: ['Histoire de jouets'],
      source: 'tmdb',
    });
    expect(result.cast.map((c) => c.name)).toEqual(['Tom Hanks', 'Tim Allen']);
    expect(result.cast[0]!.profileUrl).toBe('https://image.tmdb.org/t/p/w185/hanks.jpg');
    expect(result.crew.directors.map((c) => c.name)).toEqual(['John Lasseter']);
    expect(result.crew.writers.map((c) => c.name)).toEqual(['Joss Whedon']);
    expect(result.crew.composers.map((c) => c.name)).toEqual(['Randy Newman']);
    // YouTube only, official trailers first.
    expect(result.videos.map((v) => v.key)).toEqual(['trailer1', 'teaser1']);
    expect(result.videos[0]!.embedUrl).toBe('https://www.youtube-nocookie.com/embed/trailer1');
    expect(result.similar[0]).toMatchObject({ tmdbId: 863, title: 'Toy Story 2' });
    expect(result.watchProviders).toMatchObject({
      region: 'US',
      subscription: [{ name: 'Disney Plus', logoUrl: 'https://image.tmdb.org/t/p/w92/disney.jpg' }],
      rent: [{ name: 'Apple TV' }],
      buy: [],
      checkedAt: '2026-11-04T10:00:00.000Z',
    });
  });

  it('returns no streaming data for regions TMDB does not list', () => {
    expect(presenter.fromTmdbDetails(details, 'DE', new Date()).watchProviders).toBeNull();
  });

  it('maps list items with missing optional fields', () => {
    expect(
      presenter.fromTmdbItem({
        id: 1,
        title: 'X',
        poster_path: null,
        backdrop_path: null,
        release_date: '',
      }),
    ).toMatchObject({
      releaseDate: null,
      releaseYear: null,
      genres: [],
      voteAverage: null,
      posterUrl: null,
    });
  });
});
