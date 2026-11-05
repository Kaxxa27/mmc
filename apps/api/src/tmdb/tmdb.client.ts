import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config/app-config.js';
import { MockTmdbService } from './mock/mock-tmdb.service.js';
import { TmdbNotFoundError, type TmdbParams, TmdbUnavailableError } from './tmdb.errors.js';

export { TmdbNotFoundError, TmdbUnavailableError, type TmdbParams } from './tmdb.errors.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Minimal TMDB v3 client: authentication (read access token or API key), timeouts and retries
 * on rate limiting / transient failures. Credentials never leave the server.
 * In mock mode (TMDB_MODE=mock) requests are answered by the built-in mock dataset instead.
 */
@Injectable()
export class TmdbClient {
  private readonly logger = new Logger(TmdbClient.name);

  constructor(
    private readonly config: AppConfig,
    private readonly mockApi: MockTmdbService,
  ) {}

  get enabled(): boolean {
    return this.config.tmdb.enabled;
  }

  /** True when answers come from the built-in mock dataset. */
  get mock(): boolean {
    return this.config.tmdb.mock;
  }

  async get<T>(path: string, params: TmdbParams = {}): Promise<T> {
    if (this.config.tmdb.mock) return this.mockApi.get<T>(path, params);
    const { readAccessToken, apiKey, baseUrl, timeoutMs } = this.config.tmdb;
    if (!readAccessToken && !apiKey) throw new TmdbUnavailableError('TMDB is not configured');

    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '')
        url.searchParams.set(key, String(value));
    }
    if (!readAccessToken && apiKey) url.searchParams.set('api_key', apiKey);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (readAccessToken) headers.authorization = `Bearer ${readAccessToken}`;

    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      } catch (error) {
        if (attempt < 1) {
          await sleep(300);
          continue;
        }
        throw new TmdbUnavailableError(`TMDB request failed: ${(error as Error).message}`);
      }

      if (response.ok) return (await response.json()) as T;
      if (response.status === 404) throw new TmdbNotFoundError(`TMDB resource not found: ${path}`);
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '1');
        await sleep(Math.min(5, Math.max(1, retryAfter)) * 1000);
        continue;
      }
      if (response.status >= 500 && attempt < 1) {
        await sleep(500);
        continue;
      }
      if (response.status === 401) {
        this.logger.error(
          'TMDB rejected the credentials. Check TMDB_API_READ_ACCESS_TOKEN / TMDB_API_KEY.',
        );
      }
      throw new TmdbUnavailableError(`TMDB responded with HTTP ${response.status} for ${path}`);
    }
  }
}
