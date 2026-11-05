import { Injectable } from '@nestjs/common';
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  errors as joseErrors,
  jwtVerify,
  type JWTPayload,
} from 'jose';
import { unauthorized } from '../common/errors.js';
import { AppConfig } from '../config/app-config.js';
import type { AccessTokenClaims } from './auth.types.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifies Supabase Auth access tokens locally (no network call per request).
 * Asymmetric tokens (ES256/RS256) are checked against the project's JWKS; legacy HS256 tokens
 * against SUPABASE_JWT_SECRET.
 */
@Injectable()
export class TokenVerifier {
  private readonly issuer: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly hmacSecret: Uint8Array | undefined;

  constructor(config: AppConfig) {
    this.issuer = `${config.supabase.url}/auth/v1`;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`), {
      cacheMaxAge: 10 * 60 * 1000,
      cooldownDuration: 30 * 1000,
    });
    this.hmacSecret = config.supabase.jwtSecret
      ? new TextEncoder().encode(config.supabase.jwtSecret)
      : undefined;
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    let payload: JWTPayload;
    try {
      const { alg } = decodeProtectedHeader(token);
      const options = { issuer: this.issuer, audience: 'authenticated' };
      if (alg === 'HS256') {
        if (!this.hmacSecret) throw unauthorized('TOKEN_INVALID', 'Invalid access token.');
        ({ payload } = await jwtVerify(token, this.hmacSecret, {
          ...options,
          algorithms: ['HS256'],
        }));
      } else {
        ({ payload } = await jwtVerify(token, this.jwks, {
          ...options,
          algorithms: ['ES256', 'RS256', 'EdDSA'],
        }));
      }
    } catch (error) {
      if (error instanceof joseErrors.JWTExpired) {
        throw unauthorized(
          'TOKEN_EXPIRED',
          'Your session has expired. Refresh it or sign in again.',
        );
      }
      if (error instanceof joseErrors.JOSEError || error instanceof TypeError) {
        throw unauthorized('TOKEN_INVALID', 'Invalid access token.');
      }
      throw error;
    }

    const {
      sub,
      email,
      session_id: sessionId,
      role,
      exp,
    } = payload as JWTPayload & {
      email?: unknown;
      session_id?: unknown;
      role?: unknown;
    };
    if (
      typeof sub !== 'string' ||
      !UUID.test(sub) ||
      typeof sessionId !== 'string' ||
      role !== 'authenticated' ||
      typeof exp !== 'number'
    ) {
      throw unauthorized('TOKEN_INVALID', 'Invalid access token.');
    }
    return {
      userId: sub,
      email: typeof email === 'string' ? email.toLowerCase() : '',
      sessionId,
      expiresAt: exp,
    };
  }
}
