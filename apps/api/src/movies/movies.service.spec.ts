import { AppConfig } from '../config/app-config.js';
import type { Database } from '../database/database.types.js';
import type { TmdbCacheService } from '../tmdb/tmdb-cache.service.js';
import { type TmdbClient, TmdbNotFoundError, TmdbUnavailableError } from '../tmdb/tmdb.client.js';
import type { LocalCatalogService } from './local-catalog.service.js';
import type { MovieStore } from './movie-store.service.js';
import type { MoviePresenter } from './movie.presenter.js';
import type { MovieListResult } from './movie.types.js';
import { MoviesService } from './movies.service.js';
import type { UserMovieStateService } from './user-movie-state.service.js';

const config = AppConfig.fromEnvironment({
  DATABASE_URL: 'postgresql://localhost/db',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  TMDB_API_KEY: 'key',
});
const locale = { language: 'en-US', region: 'US' };
const localResult: MovieListResult = {
  items: [],
  page: 1,
  totalPages: 0,
  totalResults: 0,
  source: 'local',
};

function setup(cacheBehaviour: () => Promise<unknown>) {
  const local = {
    list: vi.fn().mockResolvedValue(localResult),
    search: vi.fn().mockResolvedValue(localResult),
  };
  const store = { fetchDetails: vi.fn().mockRejectedValue(new TmdbNotFoundError('gone')) };
  const service = new MoviesService(
    {} as Database,
    { enabled: true } as TmdbClient,
    { getOrFetch: vi.fn().mockImplementation(cacheBehaviour) } as unknown as TmdbCacheService,
    store as unknown as MovieStore,
    local as unknown as LocalCatalogService,
    {} as MoviePresenter,
    {
      annotate: vi
        .fn()
        .mockImplementation((_user: unknown, items: unknown) => Promise.resolve(items)),
    } as unknown as UserMovieStateService,
    config,
  );
  return { service, local };
}

describe('MoviesService', () => {
  it('falls back to the local catalog when TMDB is unreachable', async () => {
    const { service, local } = setup(() => Promise.reject(new TmdbUnavailableError('timeout')));
    await expect(service.list('popular', { page: 1, locale })).resolves.toMatchObject({
      source: 'local',
    });
    await expect(service.search({ query: 'toy', page: 1, locale })).resolves.toMatchObject({
      source: 'local',
    });
    expect(local.list).toHaveBeenCalledWith('popular', 1);
  });

  it('does not hide unexpected errors behind the fallback', async () => {
    const { service, local } = setup(() => Promise.reject(new Error('bug')));
    await expect(service.list('popular', { page: 1, locale })).rejects.toThrow('bug');
    expect(local.list).not.toHaveBeenCalled();
  });

  it('turns an unknown TMDB movie into a 404', async () => {
    const { service } = setup(() => Promise.resolve({}));
    await expect(service.details(1, { locale })).rejects.toMatchObject({ code: 'MOVIE_NOT_FOUND' });
  });
});
