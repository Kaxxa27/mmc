import { Global, Module } from '@nestjs/common';
import { GroupAccessService } from './group-access.service.js';
import { UserDirectoryService } from './user-directory.service.js';

@Global()
@Module({
  providers: [GroupAccessService, UserDirectoryService],
  exports: [GroupAccessService, UserDirectoryService],
})
export class GroupAccessModule {}
