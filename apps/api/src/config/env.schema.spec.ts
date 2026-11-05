import { parseEnv } from './env.schema.js';

const required = {
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};

describe('parseEnv', () => {
  it('applies defaults for optional settings', () => {
    const env = parseEnv(required);
    expect(env.PORT).toBe(3001);
    expect(env.TRUST_PROXY).toBe(false);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
    expect(env.TMDB_API_KEY).toBeUndefined();
  });

  it('parses flags, lists and numbers', () => {
    const env = parseEnv({
      ...required,
      PORT: '4000',
      TRUST_PROXY: 'true',
      CORS_ORIGINS: 'https://a.example, https://b.example',
      TMDB_API_KEY: '  ',
    });
    expect(env.PORT).toBe(4000);
    expect(env.TRUST_PROXY).toBe(true);
    expect(env.CORS_ORIGINS).toEqual(['https://a.example', 'https://b.example']);
    expect(env.TMDB_API_KEY).toBeUndefined();
  });

  it('reports every missing required variable', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL[\s\S]*SUPABASE_URL/);
  });
});
