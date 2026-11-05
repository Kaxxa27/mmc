import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module.js';
import { LibraryModule } from '../library/library.module.js';
import { MovieNightsController } from './movie-nights.controller.js';
import { MovieNightsService } from './movie-nights.service.js';

@Module({
  imports: [GroupsModule, LibraryModule],
  controllers: [MovieNightsController],
  providers: [MovieNightsService],
  exports: [MovieNightsService],
})
export class MovieNightsModule {}
