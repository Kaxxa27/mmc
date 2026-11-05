import { HttpException, HttpStatus } from '@nestjs/common';

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  /** Stable, machine-readable error code (e.g. `GROUP_NOT_FOUND`). */
  code: string;
  message: string;
  details?: unknown;
}

/** HTTP error carrying a stable error code that clients can rely on. */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly headers?: Record<string, string>,
  ) {
    super({ code, message, details }, status);
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppException(HttpStatus.BAD_REQUEST, code, message, details);

export const unauthorized = (code: string, message: string) =>
  new AppException(HttpStatus.UNAUTHORIZED, code, message);

export const forbidden = (code: string, message: string) =>
  new AppException(HttpStatus.FORBIDDEN, code, message);

export const notFound = (code: string, message: string) =>
  new AppException(HttpStatus.NOT_FOUND, code, message);

export const conflict = (code: string, message: string, details?: unknown) =>
  new AppException(HttpStatus.CONFLICT, code, message, details);

export const gone = (code: string, message: string) =>
  new AppException(HttpStatus.GONE, code, message);

export const unprocessable = (code: string, message: string, details?: unknown) =>
  new AppException(HttpStatus.UNPROCESSABLE_ENTITY, code, message, details);

export const tooManyRequests = (code: string, message: string, retryAfterSeconds: number) =>
  new AppException(
    HttpStatus.TOO_MANY_REQUESTS,
    code,
    message,
    { retryAfterSeconds },
    { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  );

export const serviceUnavailable = (code: string, message: string) =>
  new AppException(HttpStatus.SERVICE_UNAVAILABLE, code, message);
