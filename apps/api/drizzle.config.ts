import { defineConfig } from 'drizzle-kit';

// Schema changes are made in TypeScript (src/database/schema) and turned into SQL migrations
// inside supabase/migrations, which the Supabase CLI applies (`supabase migration up`).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: '../../supabase/migrations',
  schemaFilter: ['public'],
  migrations: { prefix: 'supabase' },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  },
  strict: true,
  verbose: true,
});
