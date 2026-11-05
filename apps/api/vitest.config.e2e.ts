import { defineConfig } from 'vitest/config';

// End-to-end tests run against the local Supabase stack (`npm run supabase:start`).
// They share one database, so files run sequentially.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
