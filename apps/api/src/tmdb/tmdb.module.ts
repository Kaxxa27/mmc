import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { HealthService } from '../health/health.service.js';
import { MockImagesController } from './mock/mock-images.controller.js';
import { MockTmdbService } from './mock/mock-tmdb.service.js';
import { TmdbCacheService } from './tmdb-cache.service.js';
import { TmdbClient } from './tmdb.client.js';

@Global()
@Module({
  controllers: [MockImagesController],
  providers: [TmdbClient, TmdbCacheService, MockTmdbService],
  exports: [TmdbClient, TmdbCacheService, MockTmdbService],
})
export class TmdbModule implements OnModuleInit {
  constructor(
    private readonly tmdb: TmdbClient,
    private readonly health: HealthService,
  ) {}

  onModuleInit(): void {
    this.health.register('tmdb', async () => {
      if (!this.tmdb.enabled) return 'disabled';
      if (this.tmdb.mock) return 'mock';
      await this.tmdb.get('/configuration');
      return 'up';
    });
  }
}
