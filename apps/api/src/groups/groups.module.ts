import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service.js';
import { GroupMoviesController } from './group-movies.controller.js';
import { GroupMoviesService } from './group-movies.service.js';
import { GroupsController } from './groups.controller.js';
import { GroupsService } from './groups.service.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';

@Module({
  controllers: [GroupsController, InvitationsController, GroupMoviesController],
  providers: [GroupsService, InvitationsService, GroupMoviesService, CommentsService],
  exports: [GroupsService, InvitationsService, GroupMoviesService, CommentsService],
})
export class GroupsModule {}
