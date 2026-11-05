import { type AnyColumn, sql, type SQL } from 'drizzle-orm';

export const descNullsLast = (column: AnyColumn | SQL) => sql`${column} desc nulls last`;
export const ascNullsLast = (column: AnyColumn | SQL) => sql`${column} asc nulls last`;

/** Escapes LIKE wildcards in user input. */
export function likePattern(input: string): string {
  return `%${input.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** `ARRAY[1,2,3]::int[]` for validated integer ids (safe: non-integers throw). */
export function intArray(values: readonly number[]): SQL {
  for (const value of values) {
    if (!Number.isSafeInteger(value)) throw new Error(`Not an integer: ${value}`);
  }
  return sql.raw(values.length > 0 ? `ARRAY[${values.join(',')}]::int[]` : `'{}'::int[]`);
}
