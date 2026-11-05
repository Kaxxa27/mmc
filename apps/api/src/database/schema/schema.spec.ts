import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from './index.js';

const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable =>
  is(value, PgTable),
);

describe('database schema', () => {
  it('defines the application tables', () => {
    expect(tables.length).toBeGreaterThanOrEqual(25);
  });

  // The Supabase Data API must never expose application data: every table needs RLS.
  it.each(tables.map((table) => [getTableConfig(table).name, table] as const))(
    '%s has row level security enabled',
    (_name, table) => {
      expect(getTableConfig(table).enableRLS).toBe(true);
    },
  );
});
