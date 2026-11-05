import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** One log line per request: method, path, status and duration. */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    response.on('finish', () => {
      const url = request.originalUrl;
      if (url.startsWith('/api/v1/health') || url.startsWith('/api/v1/mock-tmdb/')) return;
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const path = request.originalUrl.split('?')[0];
      const line = `${request.method} ${path} ${response.statusCode} ${durationMs.toFixed(1)}ms`;
      if (response.statusCode >= 500) this.logger.error(line);
      else if (response.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });
    next();
  }
}
