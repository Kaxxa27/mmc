import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../auth/auth.decorators.js';
import { notFound } from '../../common/errors.js';
import { AppConfig } from '../../config/app-config.js';
import { MOCK_IMAGE_KINDS, type MockImageKind, renderMockImage } from './mock-images.js';
import { MockTmdbService } from './mock-tmdb.service.js';

/**
 * Serves the placeholder images referenced by mock TMDB data
 * (`{TMDB_IMAGE_BASE_URL}/{size}/mock/{kind}/{id}.svg`). Only active in mock mode.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('mock-tmdb/images')
export class MockImagesController {
  constructor(
    private readonly config: AppConfig,
    private readonly mock: MockTmdbService,
  ) {}

  @Public()
  @Get(':size/mock/:kind/:file')
  image(@Param('kind') kind: string, @Param('file') file: string, @Res() response: Response): void {
    const id = /^(\d{1,10})\.svg$/.exec(file)?.[1];
    if (!this.config.tmdb.mock || !id || !MOCK_IMAGE_KINDS.includes(kind as MockImageKind)) {
      throw notFound('IMAGE_NOT_FOUND', 'Image not found.');
    }
    const svg = renderMockImage(kind as MockImageKind, this.mock.describeImage(kind, Number(id)));
    response
      .status(200)
      .setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
      .setHeader('Cache-Control', 'public, max-age=86400')
      // The web app runs on another origin; allow it to embed the images.
      .setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      .setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
      .send(svg);
  }
}
