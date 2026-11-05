import { AppConfig } from './app-config.js';

const required = {
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};

describe('AppConfig', () => {
  it('uses the mock TMDB dataset in development when no key is set', () => {
    const config = AppConfig.fromEnvironment({ ...required, NODE_ENV: 'development' });
    expect(config.tmdb).toMatchObject({ mode: 'mock', enabled: true, mock: true });
    expect(config.tmdb.imageBaseUrl).toBe('http://127.0.0.1:3001/api/v1/mock-tmdb/images');
    expect(config.devTools.enabled).toBe(true);
  });

  it('uses live TMDB as soon as a key is configured', () => {
    const config = AppConfig.fromEnvironment({
      ...required,
      NODE_ENV: 'development',
      TMDB_API_KEY: 'k',
    });
    expect(config.tmdb).toMatchObject({ mode: 'live', enabled: true, mock: false });
    expect(config.tmdb.imageBaseUrl).toBe('https://image.tmdb.org/t/p');
  });

  it('runs offline in tests and production without a key', () => {
    expect(AppConfig.fromEnvironment({ ...required, NODE_ENV: 'test' }).tmdb.mode).toBe('offline');
    const production = AppConfig.fromEnvironment({ ...required, NODE_ENV: 'production' });
    expect(production.tmdb.mode).toBe('offline');
    expect(production.devTools.enabled).toBe(false);
  });

  it('honours an explicit mode, also when the variable is blank', () => {
    expect(
      AppConfig.fromEnvironment({ ...required, NODE_ENV: 'test', TMDB_MODE: 'mock' }).tmdb.mock,
    ).toBe(true);
    expect(
      AppConfig.fromEnvironment({ ...required, NODE_ENV: 'test', TMDB_MODE: '' }).tmdb.mode,
    ).toBe('offline');
  });

  it('builds the public API URL from host and port', () => {
    const config = AppConfig.fromEnvironment({ ...required, HOST: '0.0.0.0', PORT: '4000' });
    expect(config.http.publicUrl).toBe('http://127.0.0.1:4000');
  });

  it('rejects unsafe or impossible combinations', () => {
    expect(() =>
      AppConfig.fromEnvironment({ ...required, NODE_ENV: 'production', DEV_TOOLS_ENABLED: 'true' }),
    ).toThrow(/DEV_TOOLS_ENABLED/);
    expect(() => AppConfig.fromEnvironment({ ...required, TMDB_MODE: 'live' })).toThrow(
      /TMDB_MODE/,
    );
  });
});
