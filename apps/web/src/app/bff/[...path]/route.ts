import { type NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  cookieOptions,
  hintCookieOptions,
  needsRefresh,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
  type StoredSession,
} from '@/lib/session';
import { SESSION_HINT_COOKIE } from '@/lib/session-hint';

/**
 * Backend-for-frontend: the browser calls `/bff/api/v1/*` on this origin and the request is
 * forwarded to the NestJS API with the user's access token. Tokens live only in httpOnly
 * cookies, are refreshed here when they expire, and never reach browser JavaScript.
 */
const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');

/** Endpoints that return a session: their tokens become cookies. */
const SESSION_ENDPOINTS = new Set(['auth/otp/verify', 'auth/magic-link/verify', 'dev/sign-in']);
const PASSED_RESPONSE_HEADERS = [
  'content-type',
  'content-disposition',
  'retry-after',
  'cache-control',
];

type CookieChange = { set: StoredSession } | { clear: true } | null;

interface ApiSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  [key: string]: unknown;
}

function errorJson(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ statusCode: status, error: 'Error', code, message }, { status });
}

/** State-changing requests must come from this origin (defense in depth on top of SameSite). */
function isSameOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin';
  const origin = request.headers.get('origin');
  return !origin || origin === request.nextUrl.origin;
}

function upstreamHeaders(request: NextRequest, accessToken?: string): Headers {
  const headers = new Headers();
  for (const name of ['content-type', 'accept', 'accept-language', 'user-agent']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip');
  if (ip) headers.set('x-forwarded-for', ip);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  return headers;
}

async function refreshSession(
  refreshToken: string,
  request: NextRequest,
): Promise<StoredSession | 'invalid' | null> {
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': request.headers.get('user-agent') ?? 'my-movie-catalog-web',
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (response.ok) {
      const data = (await response.json()) as ApiSession;
      return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      };
    }
    return response.status === 400 || response.status === 401 ? 'invalid' : null;
  } catch {
    return null;
  }
}

async function errorCode(response: Response): Promise<string | undefined> {
  try {
    return ((await response.clone().json()) as { code?: string }).code;
  } catch {
    return undefined;
  }
}

function applyCookies(response: NextResponse, change: CookieChange): NextResponse {
  if (change && 'set' in change) {
    const accessMaxAge = change.set.expiresAt - Math.floor(Date.now() / 1000);
    response.cookies.set(ACCESS_COOKIE, change.set.accessToken, cookieOptions(accessMaxAge));
    response.cookies.set(
      REFRESH_COOKIE,
      change.set.refreshToken,
      cookieOptions(REFRESH_MAX_AGE_SECONDS),
    );
    response.cookies.set(SESSION_HINT_COOKIE, '1', hintCookieOptions());
  } else if (change && 'clear' in change) {
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    response.cookies.delete(SESSION_HINT_COOKIE);
  }
  return response;
}

function readScope(body: ArrayBuffer | undefined): string | undefined {
  if (!body || body.byteLength === 0) return undefined;
  try {
    const scope = (JSON.parse(new TextDecoder().decode(body)) as { scope?: unknown }).scope;
    return typeof scope === 'string' ? scope : undefined;
  } catch {
    return undefined;
  }
}

function withoutTokens<T extends Partial<ApiSession>>(session: T) {
  const {
    accessToken: _access,
    refreshToken: _refresh,
    tokenType: _type,
    expiresIn: _expiresIn,
    ...rest
  } = session;
  return rest;
}

async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  if (path[0] !== 'api' || path[1] !== 'v1' || path.length < 3) {
    return errorJson(404, 'NOT_FOUND', 'Not found.');
  }
  const endpoint = path.slice(2).join('/');
  const method = request.method.toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD';
  if (!isRead && !isSameOrigin(request)) {
    return errorJson(403, 'CROSS_SITE_REQUEST', 'Cross-site request rejected.');
  }

  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  let change: CookieChange = null;

  // Refresh ahead of time when the access token is missing or about to expire.
  if (refreshToken && needsRefresh(accessToken)) {
    const refreshed = await refreshSession(refreshToken, request);
    if (refreshed === 'invalid') {
      accessToken = undefined;
      change = { clear: true };
    } else if (refreshed) {
      accessToken = refreshed.accessToken;
      change = { set: refreshed };
    }
  }

  const url = `${API_URL}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  const body = isRead ? undefined : await request.arrayBuffer();
  const send = (token?: string) =>
    fetch(url, {
      method,
      headers: upstreamHeaders(request, token),
      body,
      cache: 'no-store',
      redirect: 'manual',
    });

  let upstream: Response;
  try {
    upstream = await send(accessToken);
    // An access token rejected as expired gets one retry with a fresh token.
    if (upstream.status === 401 && refreshToken && !(change && 'set' in change)) {
      const code = await errorCode(upstream);
      if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID') {
        const refreshed = await refreshSession(refreshToken, request);
        if (refreshed && refreshed !== 'invalid') {
          change = { set: refreshed };
          upstream = await send(refreshed.accessToken);
        } else if (refreshed === 'invalid') {
          change = { clear: true };
        }
      } else if (code === 'SESSION_REVOKED') {
        change = { clear: true };
      }
    }
  } catch {
    return applyCookies(
      errorJson(502, 'API_UNAVAILABLE', 'The API is not reachable. Is it running?'),
      change,
    );
  }

  // Sign-in endpoints: store the session in cookies and strip the tokens from the response.
  if (upstream.ok && (SESSION_ENDPOINTS.has(endpoint) || endpoint === 'dev/demo')) {
    const data = (await upstream.json()) as ApiSession & { users?: ApiSession[] };
    const session = endpoint === 'dev/demo' ? data.users?.[0] : data;
    if (session?.accessToken) {
      change = {
        set: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
        },
      };
    }
    const safe =
      endpoint === 'dev/demo'
        ? { ...data, users: (data.users ?? []).map(withoutTokens) }
        : withoutTokens(data);
    return applyCookies(NextResponse.json(safe, { status: upstream.status }), change);
  }

  // Signing out "other devices" keeps this device's session.
  const signOutScope = endpoint === 'auth/sign-out' ? readScope(body) : undefined;
  const signedOut =
    (endpoint === 'auth/sign-out' &&
      signOutScope !== 'others' &&
      (upstream.ok || upstream.status === 401)) ||
    (endpoint === 'me' && method === 'DELETE' && upstream.ok);
  if (signedOut) change = { clear: true };

  const headers = new Headers();
  for (const name of PASSED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  const response = new NextResponse(
    upstream.status === 204 || method === 'HEAD' ? null : upstream.body,
    {
      status: upstream.status,
      headers,
    },
  );
  return applyCookies(response, change);
}

export { handle as DELETE, handle as GET, handle as PATCH, handle as POST, handle as PUT };
