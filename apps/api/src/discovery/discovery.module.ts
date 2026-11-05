import { Module } from '@nestjs/common';
import { LibraryModule } from '../library/library.module.js';
import { CalendarService } from './calendar.service.js';
import { DiscoveryController } from './discovery.controller.js';
import { HomeService } from './home.service.js';
import { RecommendationsService } from './recommendations.service.js';

@Module({
  imports: [LibraryModule],
  controllers: [DiscoveryController],
  providers: [HomeService, RecommendationsService, CalendarService],
})
export class DiscoveryModule {}
