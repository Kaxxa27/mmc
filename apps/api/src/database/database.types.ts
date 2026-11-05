import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

/** A transaction handle; accepted wherever a `Database` is (both can run queries). */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export type DbExecutor = Database | Transaction;
