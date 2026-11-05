import { ConsoleLogger, type LogLevel, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppConfig } from './config/app-config.js';
import { setupSwagger } from './swagger.js';

const LOG_LEVELS: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

export function createLogger(config: AppConfig): ConsoleLogger {
  const index = LOG_LEVELS.indexOf(config.logging.level);
  return new ConsoleLogger({
    json: config.logging.format === 'json',
    colors: config.logging.format === 'pretty',
    logLevels: LOG_LEVELS.slice(0, index + 1),
  });
}

/** HTTP-level setup shared by `main.ts` and the end-to-end tests. */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  app.set('trust proxy', config.http.trustProxy);
  app.disable('x-powered-by');
  app.use(helmet());
  app.enableCors({
    origin: config.http.corsOrigins,
    credentials: true,
    exposedHeaders: ['Retry-After'],
    maxAge: 600,
  });
  app.useBodyParser('json', { limit: '1mb' });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  if (config.http.swaggerEnabled) setupSwagger(app, config);
}
