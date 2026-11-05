import { Module } from '@nestjs/common';
import { CollectionsModule } from '../collections/collections.module.js';
import { GroupsModule } from '../groups/groups.module.js';
import { LibraryModule } from '../library/library.module.js';
import { MovieNightsModule } from '../movie-nights/movie-nights.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { DevToolsController } from './dev-tools.controller.js';
import { DevToolsGuard } from './dev-tools.guard.js';
import { DevToolsService } from './dev-tools.service.js';

@Module({
  imports: [ProfilesModule, GroupsModule, LibraryModule, CollectionsModule, MovieNightsModule],
  controllers: [DevToolsController],
  providers: [DevToolsService, DevToolsGuard],
})
export class DevToolsModule {}
