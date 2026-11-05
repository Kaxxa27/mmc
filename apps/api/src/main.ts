import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp, createLogger } from './app.setup.js';
import { AppConfig } from './config/app-config.js';
import { loadEnvFiles } from './config/load-env.js';

loadEnvFiles();

const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
const config = app.get(AppConfig);
app.useLogger(createLogger(config));
configureApp(app, config);
app.enableShutdownHooks();

await app.listen(config.http.port, config.http.host);

const url = `http://${config.http.host}:${config.http.port}`;
const logger = new Logger('Bootstrap');
logger.log(`API listening on ${url}/api/v1`);
if (config.http.swaggerEnabled) logger.log(`API docs: ${url}/api/docs`);
if (config.tmdb.mode === 'mock') {
  logger.warn(
    'TMDB mock mode: movie data comes from the built-in mock dataset (no TMDB key needed).',
  );
} else if (config.tmdb.mode === 'offline') {
  logger.warn('TMDB offline mode: only the local sample catalog is available.');
}
if (config.devTools.enabled) {
  logger.warn(`Developer tools enabled at ${url}/api/v1/dev (never enable them in production).`);
}
