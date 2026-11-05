import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { findPgError, PG_ERROR } from '../../database/pg-errors.js';
import { AppException, type ApiErrorBody } from '../errors.js';

const DEFAULT_CODES: Partial<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE',
};

/** Formats every error as `ApiErrorBody` and never leaks internals for unexpected errors. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const { body, headers } = this.toBody(exception);

    if (body.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${request.method} ${request.originalUrl} failed: ${stack}`);
    }

    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): { body: ApiErrorBody; headers: Record<string, string> } {
    if (exception instanceof AppException) {
      const status = exception.getStatus();
      return {
        body: {
          statusCode: status,
          error: this.reason(status),
          code: exception.code,
          message: exception.message,
          ...(exception.details === undefined ? {} : { details: exception.details }),
        },
        headers: exception.headers ?? {},
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      let message = exception.message;
      let details: unknown;
      if (typeof response === 'object' && response !== null && 'message' in response) {
        const raw = response.message;
        if (Array.isArray(raw)) {
          // class-validator errors from the ValidationPipe.
          message = 'Request validation failed';
          details = raw;
        } else if (typeof raw === 'string') {
          message = raw;
        }
      }
      return {
        body: {
          statusCode: status,
          error: this.reason(status),
          code:
            status === 400 && details ? 'VALIDATION_FAILED' : (DEFAULT_CODES[status] ?? 'ERROR'),
          message,
          ...(details === undefined ? {} : { details }),
        },
        headers: {},
      };
    }

    const pgError = findPgError(exception);
    if (pgError?.code === PG_ERROR.uniqueViolation) {
      return this.simple(HttpStatus.CONFLICT, 'CONFLICT', 'The resource already exists.');
    }
    if (pgError?.code === PG_ERROR.foreignKeyViolation) {
      return this.simple(HttpStatus.CONFLICT, 'CONFLICT', 'A related resource does not exist.');
    }
    if (pgError?.code === PG_ERROR.checkViolation || pgError?.code === PG_ERROR.notNullViolation) {
      return this.simple(HttpStatus.BAD_REQUEST, 'INVALID_DATA', 'The data is not valid.');
    }
    if (pgError?.code === PG_ERROR.invalidTextRepresentation) {
      return this.simple(HttpStatus.BAD_REQUEST, 'INVALID_IDENTIFIER', 'Invalid identifier.');
    }

    return this.simple(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'INTERNAL_ERROR',
      'Something went wrong on our side. Please try again.',
    );
  }

  private simple(statusCode: number, code: string, message: string) {
    return { body: { statusCode, error: this.reason(statusCode), code, message }, headers: {} };
  }

  private reason(status: number): string {
    const name = HttpStatus[status];
    return typeof name === 'string'
      ? name
          .toLowerCase()
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      : 'Error';
  }
}
