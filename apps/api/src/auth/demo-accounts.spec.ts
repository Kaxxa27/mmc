import { describe, expect, it } from 'vitest';
import { AppConfig } from '../config/app-config.js';
import { demoEmail, isSharedDemoEmail } from './demo-accounts.js';

const required = {
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};

describe('shared demo accounts', () => {
  it('recognizes only the three fixed demo addresses', () => {
    expect(isSharedDemoEmail('anna.demo@example.com')).toBe(true);
    expect(isSharedDemoEmail(' Chloe.Demo@Example.com ')).toBe(true);
    expect(isSharedDemoEmail(demoEmail('ben'))).toBe(true);
    expect(isSharedDemoEmail('anna.team@example.com')).toBe(false);
    expect(isSharedDemoEmail('someone@gmail.com')).toBe(false);
    expect(isSharedDemoEmail(null)).toBe(false);
  });

  it('is off by default and can be enabled in production', () => {
    expect(AppConfig.fromEnvironment({ ...required }).demoAccounts.enabled).toBe(false);
    const production = AppConfig.fromEnvironment({
      ...required,
      NODE_ENV: 'production',
      DEMO_ACCOUNTS_ENABLED: 'true',
    });
    expect(production.demoAccounts.enabled).toBe(true);
    expect(production.devTools.enabled).toBe(false);
  });
});
