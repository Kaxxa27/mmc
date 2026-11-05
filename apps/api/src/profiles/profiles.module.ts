import { Module } from '@nestjs/common';
import { AccountService } from './account.service.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

@Module({
  controllers: [ProfilesController],
  providers: [ProfilesService, AccountService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
