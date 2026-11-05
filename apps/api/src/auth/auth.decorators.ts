import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import { unauthorized } from '../common/errors.js';
import type { AuthenticatedRequest, AuthUser, ClientContext } from './auth.types.js';

export type AuthMode = 'required' | 'optional' | 'public';
export const AUTH_MODE_KEY = 'auth:mode';

/** No authentication; the access token is ignored. */
export const Public = () => SetMetadata(AUTH_MODE_KEY, 'public' satisfies AuthMode);

/** Works for guests; if a valid access token is sent, `@OptionalUser()` receives the user. */
export const OptionalAuth = () => SetMetadata(AUTH_MODE_KEY, 'optional' satisfies AuthMode);

/** The authenticated user (endpoint must not be `@Public()`). */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw unauthorized('AUTH_REQUIRED', 'Sign in to continue.');
    return request.user;
  },
);

export const OptionalUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthUser | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);

/** IP address and user agent of the caller (respects TRUST_PROXY). */
export const Client = createParamDecorator(
  (_: unknown, context: ExecutionContext): ClientContext => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userAgent = request.headers['user-agent'];
    return {
      ip: request.ip ?? null,
      userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : null,
    };
  },
);
