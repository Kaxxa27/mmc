import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { unauthorized } from '../common/errors.js';
import { AuthSessionsRepository } from './auth-sessions.repository.js';
import { AUTH_MODE_KEY, type AuthMode } from './auth.decorators.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { TokenVerifier } from './token-verifier.service.js';

/**
 * Global guard: every endpoint requires a valid `Authorization: Bearer <access token>` unless it
 * is marked `@Public()` or `@OptionalAuth()`. Besides the signature, it checks that the session
 * still exists, so "sign out everywhere" takes effect immediately.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifier,
    private readonly sessions: AuthSessionsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const mode =
      this.reflector.getAllAndOverride<AuthMode | undefined>(AUTH_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'required';
    if (mode === 'public') return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      if (mode === 'optional') return true;
      throw unauthorized('AUTH_REQUIRED', 'Sign in to continue.');
    }

    const claims = await this.verifier.verify(token);
    if (!(await this.sessions.isActive(claims.sessionId, claims.userId))) {
      throw unauthorized('SESSION_REVOKED', 'This session has been signed out. Sign in again.');
    }
    request.user = {
      id: claims.userId,
      email: claims.email,
      sessionId: claims.sessionId,
      accessToken: token,
    };
    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const header = request.headers.authorization;
    if (typeof header !== 'string') return undefined;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value.trim() : undefined;
  }
}
