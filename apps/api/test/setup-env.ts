import { loadEnvFiles } from '../src/config/load-env.js';

// End-to-end tests run against the local Supabase stack with the values from apps/api/.env.
// TMDB is offline so the tests are deterministic (bundled sample movies) and need no network;
// test files can switch to the mock dataset by setting TMDB_MODE before creating the app.
process.env.NODE_ENV = 'test';
process.env.TMDB_MODE = 'offline';
process.env.TMDB_API_READ_ACCESS_TOKEN = '';
process.env.TMDB_API_KEY = '';
process.env.DEV_TOOLS_ENABLED = 'false';
process.env.JOBS_ENABLED = 'false';
process.env.SWAGGER_ENABLED = 'false';
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? 'warn';
process.env.RATE_LIMIT_PER_MINUTE = '100000';
process.env.OTP_REQUESTS_PER_HOUR_PER_IP = '100000';
process.env.OTP_VERIFICATIONS_PER_15_MIN_PER_IP = '100000';
loadEnvFiles();
