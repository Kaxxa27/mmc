import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, GET, POST } from './route';

const BASE = 'http://localhost:3000/bff/api/v1';

function jwt(expiresInSeconds: number): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'ES256' })}.${encode({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds })}.sig`;
}

function request(
  path: string,
  init: { method?: string; body?: unknown; cookies?: Record<string, string>; site?: string } = {},
) {
  const headers = new Headers({
    'content-type': 'application/json',
    'sec-fetch-site': init.site ?? 'same-origin',
  });
  if (init.cookies) {
    headers.set(
      'cookie',
      Object.entries(init.cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; '),
    );
  }
  return new NextRequest(`${BASE}/${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function context(path: string) {
  return { params: Promise.resolve({ path: ['api', 'v1', ...path.split('?')[0]!.split('/')] }) };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** `name -> raw Set-Cookie line` from a response. */
function setCookies(response: Response): Record<string, string> {
  return Object.fromEntries(
    response.headers.getSetCookie().map((line) => [line.split('=')[0]!, line]),
  );
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BFF route', () => {
  it('stores sign-in tokens in httpOnly cookies and strips them from the body', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        accessToken: jwt(3600),
        refreshToken: 'refresh-1',
        tokenType: 'bearer',
        expiresIn: 3600,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'u1', email: 'anna@example.com' },
        needsOnboarding: false,
      }),
    );
    const response = await POST(
      request('dev/sign-in', { method: 'POST', body: { email: 'anna@example.com' } }),
      context('dev/sign-in'),
    );
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      expiresAt: expect.any(Number),
      user: { id: 'u1', email: 'anna@example.com' },
      needsOnboarding: false,
    });
    const cookies = setCookies(response);
    expect(cookies.mmc_at).toMatch(/HttpOnly/i);
    expect(cookies.mmc_rt).toMatch(/^mmc_rt=refresh-1;.*HttpOnly/i);
    expect(cookies.mmc_signed_in).toMatch(/^mmc_signed_in=1;/);
    expect(cookies.mmc_signed_in).not.toMatch(/HttpOnly/i);
  });

  it('rejects cross-site writes before calling the API', async () => {
    const response = await POST(
      request('groups', { method: 'POST', body: { name: 'x' }, site: 'cross-site' }),
      context('groups'),
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the access token as a bearer header', async () => {
    const token = jwt(3600);
    fetchMock.mockResolvedValueOnce(json(200, { id: 'u1' }));
    const response = await GET(
      request('me', { cookies: { mmc_at: token, mmc_rt: 'r' } }),
      context('me'),
    );
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:3001/api/v1/me');
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${token}`);
  });

  it('refreshes an expiring token before the request and renews the cookies', async () => {
    const fresh = jwt(3600);
    fetchMock
      .mockResolvedValueOnce(
        json(200, {
          accessToken: fresh,
          refreshToken: 'refresh-2',
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        }),
      )
      .mockResolvedValueOnce(json(200, { id: 'u1' }));
    const response = await GET(
      request('me', { cookies: { mmc_at: jwt(10), mmc_rt: 'refresh-1' } }),
      context('me'),
    );
    expect(fetchMock.mock.calls[0]![0]).toBe('http://127.0.0.1:3001/api/v1/auth/refresh');
    expect(new Headers(fetchMock.mock.calls[1]![1]?.headers).get('authorization')).toBe(
      `Bearer ${fresh}`,
    );
    expect(setCookies(response).mmc_rt).toMatch(/^mmc_rt=refresh-2;/);
  });

  it('clears the session when the API says it was revoked', async () => {
    fetchMock.mockResolvedValueOnce(
      json(401, { statusCode: 401, code: 'SESSION_REVOKED', message: 'Signed out' }),
    );
    const response = await GET(
      request('me', { cookies: { mmc_at: jwt(3600), mmc_rt: 'r' } }),
      context('me'),
    );
    expect(response.status).toBe(401);
    const cookies = setCookies(response);
    for (const name of ['mmc_at', 'mmc_rt', 'mmc_signed_in'])
      expect(cookies[name]).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('keeps this device signed in when signing out other devices', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const cookies = { mmc_at: jwt(3600), mmc_rt: 'r' };
    const others = await POST(
      request('auth/sign-out', { method: 'POST', body: { scope: 'others' }, cookies }),
      context('auth/sign-out'),
    );
    expect(others.headers.getSetCookie()).toEqual([]);
    const local = await POST(
      request('auth/sign-out', { method: 'POST', body: { scope: 'local' }, cookies }),
      context('auth/sign-out'),
    );
    expect(setCookies(local).mmc_rt).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('clears cookies after the account is deleted', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await DELETE(
      request('me', {
        method: 'DELETE',
        body: { code: '123456' },
        cookies: { mmc_at: jwt(3600), mmc_rt: 'r' },
      }),
      context('me'),
    );
    expect(response.status).toBe(204);
    expect(setCookies(response).mmc_at).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('answers 502 when the API is down and 404 outside /api/v1', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect((await GET(request('config'), context('config'))).status).toBe(502);
    const outside = await GET(request('config'), {
      params: Promise.resolve({ path: ['etc', 'passwd'] }),
    });
    expect(outside.status).toBe(404);
  });
});
