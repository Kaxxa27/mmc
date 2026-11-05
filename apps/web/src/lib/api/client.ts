import type { ApiErrorBody } from './types';

/** An error response from the API (or the BFF), with its stable `code`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Seconds to wait before retrying (rate limits). */
  get retryAfterSeconds(): number | undefined {
    const value = (this.details as { retryAfterSeconds?: unknown } | undefined)?.retryAfterSeconds;
    return typeof value === 'number' ? value : undefined;
  }

  /** Field validation messages from the API, if any. */
  get validationMessages(): string[] {
    return Array.isArray(this.details) ? this.details.map(String) : [];
  }
}

export type QueryValue =
  string | number | boolean | null | undefined | readonly (string | number)[];
export type Query = Record<string, QueryValue>;

/** `{ a: 1, ids: [1, 2], empty: undefined }` -> `?a=1&ids=1,2` */
export function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

/** Calls the API through the Next.js BFF (`/bff/api/v1/...`), which attaches the session. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`/bff/api/v1${path}${buildQuery(options.query)}`, {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: options.signal,
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!response.ok) {
    const error = (data ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(
      response.status,
      error.code ?? 'ERROR',
      error.message ?? `Request failed with status ${response.status}`,
      error.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) =>
    apiRequest<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'PUT', body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body: body ?? {} }),
  delete: <T = void>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'DELETE', body }),
  upload: <T>(path: string, form: FormData) => apiRequest<T>(path, { method: 'PUT', form }),
};

/** A user-facing message for any error thrown by the API helpers. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.validationMessages.length > 0) return error.validationMessages.join('. ');
    return error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}
