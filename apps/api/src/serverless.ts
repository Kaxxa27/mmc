import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp, createLogger } from './app.setup.js';
import { AppConfig } from './config/app-config.js';
import { loadEnvFiles } from './config/load-env.js';

type RequestListener = (request: IncomingMessage, response: ServerResponse) => void;

let server: Promise<RequestListener> | undefined;

/** Builds the Nest application once per function instance and reuses it for later requests. */
async function createServer(): Promise<RequestListener> {
  loadEnvFiles();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(AppConfig);
  app.useLogger(createLogger(config));
  configureApp(app, config);
  await app.init();
  return app.getHttpAdapter().getInstance() as RequestListener;
}

/** Entry point for serverless platforms such as Vercel (see apps/api/api/index.js). */
export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  server ??= createServer().catch((error: unknown) => {
    server = undefined;
    throw error;
  });
  (await server)(request, response);
}
