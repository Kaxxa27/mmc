/** TMDB is not configured, unreachable or failing. Callers fall back to local data. */
export class TmdbUnavailableError extends Error {
  override readonly name = 'TmdbUnavailableError';
}

export class TmdbNotFoundError extends Error {
  override readonly name = 'TmdbNotFoundError';
}

export type TmdbParams = Record<string, string | number | boolean | undefined | null>;
