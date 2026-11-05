import { AppConfig } from '../../config/app-config.js';
import type { GenresService } from '../../movies/genres.service.js';
import { MoviePresenter } from '../../movies/movie.presenter.js';
import { TmdbNotFoundError } from '../tmdb.errors.js';
import type {
  TmdbMovieDetails,
  TmdbMovieListItem,
  TmdbPaged,
  TmdbPerson,
  TmdbPersonSearchItem,
} from '../tmdb.types.js';
import { MOCK_MOVIES } from './mock-movies.js';
import { MOCK_PEOPLE } from './mock-people.js';
import { MockTmdbService, normalizeText } from './mock-tmdb.service.js';

const config = AppConfig.fromEnvironment({
  NODE_ENV: 'test',
  TMDB_MODE: 'mock',
  DATABASE_URL: 'postgresql://localhost/db',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
});
const mock = new MockTmdbService(config);
const list = (path: string, params: Record<string, string | number> = {}) =>
  mock.get<TmdbPaged<TmdbMovieListItem>>(path, params);
const titles = (page: TmdbPaged<TmdbMovieListItem>) => page.results.map((movie) => movie.title);
const today = new Date().toISOString().slice(0, 10);

describe('MockTmdbService', () => {
  it('has a consistent dataset', () => {
    expect(new Set(MOCK_MOVIES.map((m) => m.id)).size).toBe(MOCK_MOVIES.length);
    expect(new Set(MOCK_PEOPLE.map((p) => p.slug)).size).toBe(MOCK_PEOPLE.length);
    expect(MOCK_MOVIES.filter((m) => m.fictional)).toHaveLength(10);
  });

  it('serves popular movies, released only, most popular first, 20 per page', async () => {
    const first = await list('/movie/popular');
    expect(first.results).toHaveLength(20);
    expect(first.total_results).toBe(50);
    expect(first.total_pages).toBe(3);
    expect(first.results.every((m) => m.release_date! <= today)).toBe(true);
    const popularity = first.results.map((m) => m.popularity!);
    expect(popularity).toEqual([...popularity].sort((a, b) => b - a));
    expect((await list('/movie/popular', { page: 3 })).results).toHaveLength(10);
    expect((await list('/movie/popular', { page: 4 })).results).toHaveLength(0);
  });

  it('keeps upcoming and now playing lists filled with dates relative to today', async () => {
    const upcoming = await list('/movie/upcoming');
    expect(upcoming.results).toHaveLength(6);
    expect(upcoming.results.every((m) => m.release_date! > today)).toBe(true);
    const nowPlaying = await list('/movie/now_playing');
    expect(titles(nowPlaying)).toEqual(
      expect.arrayContaining([
        'Paper Kites',
        'Echoes of Tomorrow',
        "Grandma's Heist",
        'The Silent Forest',
      ]),
    );
  });

  it('sorts top rated by rating and requires enough votes', async () => {
    const top = await list('/movie/top_rated');
    expect(top.results[0]!.vote_average).toBeGreaterThanOrEqual(8.5);
    expect(top.results.every((m) => m.vote_count! >= 1000)).toBe(true);
  });

  it('searches titles in any language, accents optional', async () => {
    expect(titles(await list('/search/movie', { query: 'toy' }))[0]).toBe('Toy Story');
    expect(titles(await list('/search/movie', { query: 'унесенные' }))).toEqual(['Spirited Away']);
    expect(titles(await list('/search/movie', { query: 'Findet Nemo' }))).toEqual(['Finding Nemo']);
    expect(titles(await list('/search/movie', { query: 'amelie' }))).toEqual(['Amélie']);
    expect(titles(await list('/search/movie', { query: 'dune', year: 2024 }))).toEqual([
      'Dune: Part Two',
    ]);
    expect((await list('/search/movie', { query: 'zzzz' })).total_results).toBe(0);
  });

  it('localises titles, overviews and genres', async () => {
    const russian = await mock.get<TmdbMovieDetails>('/movie/862', { language: 'ru-RU' });
    expect(russian.title).toBe('История игрушек');
    expect(russian.genres.map((g) => g.name)).toEqual([
      'Мультфильм',
      'Приключения',
      'Семейный',
      'Комедия',
    ]);
    const genres = await mock.get<{ genres: { id: number; name: string }[] }>('/genre/movie/list', {
      language: 'ru',
    });
    expect(genres.genres.find((g) => g.id === 878)?.name).toBe('Фантастика');
  });

  it('applies discover filters with TMDB parameter names', async () => {
    const family = await list('/discover/movie', {
      with_genres: '16|35',
      'with_runtime.lte': 100,
      'vote_average.gte': 8,
      certification_country: 'US',
      'certification.lte': 'PG',
      sort_by: 'title.asc',
    });
    expect(titles(family)).toEqual([
      'Klaus',
      'My Neighbor Totoro',
      'Paper Kites',
      'The Lion King',
      'Toy Story',
      'Up',
      'WALL·E',
    ]);

    const hanks = MOCK_PEOPLE.find((p) => p.slug === 'tom-hanks')!;
    expect(titles(await list('/discover/movie', { with_cast: String(hanks.id) })).sort()).toEqual([
      'Forrest Gump',
      'Toy Story',
    ]);
    const nineties = await list('/discover/movie', {
      'primary_release_date.gte': '1990-01-01',
      'primary_release_date.lte': '1999-12-31',
      with_original_language: 'en',
    });
    expect(nineties.results.every((m) => m.release_date!.startsWith('199'))).toBe(true);
  });

  it('returns full details with every appended section', async () => {
    const details = await mock.get<TmdbMovieDetails>('/movie/27205', {
      append_to_response:
        'credits,videos,release_dates,similar,recommendations,watch/providers,alternative_titles',
    });
    expect(details.credits?.cast[0]).toMatchObject({
      name: 'Leonardo DiCaprio',
      character: 'Dom Cobb',
      order: 0,
    });
    expect(details.credits?.crew.find((c) => c.job === 'Director')?.name).toBe('Christopher Nolan');
    expect(details.videos?.results[0]).toMatchObject({
      site: 'YouTube',
      type: 'Trailer',
      official: true,
    });
    expect(
      details.release_dates?.results.find((r) => r.iso_3166_1 === 'GB')?.release_dates[0]
        ?.certification,
    ).toBe('12A');
    expect(details['watch/providers']?.results.US?.flatrate?.[0]?.provider_name).toBe('Max');
    expect(details.alternative_titles?.titles.map((t) => t.title)).toContain('Начало');
    // Same director first among the recommendations.
    expect(details.recommendations?.results.slice(0, 3).map((m) => m.title)).toEqual(
      expect.arrayContaining(['Interstellar', 'The Dark Knight']),
    );
    expect(details.similar?.results.length).toBeGreaterThan(0);
  });

  it('marks fictional movies and gives them no streaming offers', async () => {
    const fictional = await mock.get<TmdbMovieDetails>('/movie/900000007', {
      append_to_response: 'watch/providers',
    });
    expect(fictional.overview).toContain('Fictional movie from the mock dataset');
    expect(fictional['watch/providers']?.results).toEqual({});
  });

  it('serves people with filmographies', async () => {
    const search = await mock.get<TmdbPaged<TmdbPersonSearchItem>>('/search/person', {
      query: 'nolan',
    });
    expect(search.results.map((p) => p.name)).toEqual(['Christopher Nolan', 'Jonathan Nolan']);
    const nolan = await mock.get<TmdbPerson>(`/person/${search.results[0]!.id}`, {
      append_to_response: 'movie_credits',
    });
    expect(nolan.biography).toMatch(
      /^Christopher Nolan is a British-American filmmaker\. Known for /,
    );
    expect(nolan.birthday).toBe('1970-07-30');
    const directed = nolan
      .movie_credits!.crew.filter((c) => c.job === 'Director')
      .map((c) => c.title);
    expect(directed.sort()).toEqual([
      'Inception',
      'Interstellar',
      'Oppenheimer',
      'The Dark Knight',
    ]);
  });

  it('answers unknown movies and people with 404', async () => {
    await expect(mock.get('/movie/1')).rejects.toBeInstanceOf(TmdbNotFoundError);
    await expect(mock.get('/person/1')).rejects.toBeInstanceOf(TmdbNotFoundError);
  });

  it('produces responses the real presenter understands', async () => {
    const genres = {
      refs: (ids: readonly number[]) => ids.map((id) => ({ id, name: String(id) })),
    } as unknown as GenresService;
    const presenter = new MoviePresenter(config, genres);
    const details = await mock.get<TmdbMovieDetails>('/movie/354912', {
      append_to_response:
        'credits,videos,release_dates,similar,recommendations,watch/providers,alternative_titles',
    });
    const view = presenter.fromTmdbDetails(details, 'US', new Date());
    expect(view).toMatchObject({
      title: 'Coco',
      certification: 'PG',
      posterUrl: 'http://127.0.0.1:3001/api/v1/mock-tmdb/images/w500/mock/poster/354912.svg',
      crew: { directors: [{ name: 'Lee Unkrich' }, { name: 'Adrian Molina' }] },
      watchProviders: { subscription: [{ name: 'Disney Plus' }] },
    });
    expect(view.watchProviders?.attribution).toContain('Mock');
    expect(view.videos).toHaveLength(2);
  });

  it('normalises text for matching', () => {
    expect(normalizeText('Amélie')).toBe('amelie');
    expect(normalizeText('Унесённые призраками!')).toBe('унесенные призраками');
  });
});
