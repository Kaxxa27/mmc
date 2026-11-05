import type { Request } from 'express';

/** The signed-in user, attached to the request by `AuthGuard`. */
export interface AuthUser {
  id: string;
  email: string;
  sessionId: string;
  accessToken: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface AccessTokenClaims {
  userId: string;
  email: string;
  sessionId: string;
  expiresAt: number;
}

export interface ClientContext {
  ip: string | null;
  userAgent: string | null;
}
