import { AppConfig } from '../config/app-config.js';
import { MockTmdbService } from './mock/mock-tmdb.service.js';
import { TmdbClient, TmdbNotFoundError, TmdbUnavailableError } from './tmdb.client.js';

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost/db',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};

const createClient = (env: Record<string, string> = {}) => {
  const config = AppConfig.fromEnvironment({ ...baseEnv, ...env });
  return new TmdbClient(config, new MockTmdbService(config));
};

describe('TmdbClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('answers from the mock dataset in mock mode, without network access', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = createClient({ TMDB_MODE: 'mock' });
    expect(client.mock).toBe(true);
    await expect(client.get('/movie/862')).resolves.toMatchObject({ id: 862, title: 'Toy Story' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is disabled without credentials', async () => {
    const client = createClient();
    expect(client.enabled).toBe(false);
    await expect(client.get('/movie/popular')).rejects.toBeInstanceOf(TmdbUnavailableError);
  });

  it('sends the read access token and query parameters', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createClient({ TMDB_API_READ_ACCESS_TOKEN: 'token-123' });

    await expect(
      client.get('/search/movie', { query: 'up', page: 2, year: undefined }),
    ).resolves.toEqual({
      ok: 1,
    });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://api.themoviedb.org/3/search/movie?query=up&page=2');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer token-123');
  });

  it('falls back to the api_key parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await createClient({ TMDB_API_KEY: 'key-1' }).get('/genre/movie/list');
    expect((fetchMock.mock.calls[0]![0] as URL).searchParams.get('api_key')).toBe('key-1');
  });

  it('maps 404 to TmdbNotFoundError and 401 to TmdbUnavailableError', async () => {
    const client = createClient({ TMDB_API_KEY: 'k' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
    await expect(client.get('/movie/1')).rejects.toBeInstanceOf(TmdbNotFoundError);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(client.get('/movie/1')).rejects.toBeInstanceOf(TmdbUnavailableError);
  });

  it('retries once on network errors', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response('{"id":1}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createClient({ TMDB_API_KEY: 'k' }).get('/movie/1')).resolves.toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
