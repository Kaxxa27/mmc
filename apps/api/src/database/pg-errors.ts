/** Subset of PostgreSQL error codes the API translates into HTTP errors. */
export const PG_ERROR = {
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
  checkViolation: '23514',
  notNullViolation: '23502',
  invalidTextRepresentation: '22P02',
} as const;

interface PgErrorLike {
  code: string;
  constraint?: string;
  detail?: string;
}

/** Drizzle wraps driver errors; this finds the underlying PostgreSQL error if there is one. */
export function findPgError(error: unknown): PgErrorLike | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (
      typeof current === 'object' &&
      'code' in current &&
      typeof current.code === 'string' &&
      /^[0-9A-Z]{5}$/.test(current.code)
    ) {
      return current as PgErrorLike;
    }
    current = typeof current === 'object' && 'cause' in current ? current.cause : undefined;
  }
  return undefined;
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pgError = findPgError(error);
  return (
    pgError?.code === PG_ERROR.uniqueViolation &&
    (constraint === undefined || pgError.constraint === constraint)
  );
}
