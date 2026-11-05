import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { UploadedImage } from '../media/media.service.js';
import { IMAGE_UPLOAD, IMAGE_UPLOAD_BODY } from '../profiles/profiles.controller.js';
import {
  ChangeMemberRoleDto,
  CreateGroupDto,
  ListGroupsQueryDto,
  TransferOwnershipDto,
  UpdateGroupDto,
} from './dto/groups.dto.js';
import type { GroupDetails, GroupSummary, MemberView } from './groups.types.js';
import { GroupsService } from './groups.service.js';

const ID = new ParseUUIDPipe();

@ApiTags('Groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  /** Groups you belong to, with your role. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListGroupsQueryDto): Promise<GroupSummary[]> {
    return this.groups.listMine(user.id, query.includeArchived);
  }

  /** Creates a family or friends space; you become its owner. */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto): Promise<GroupDetails> {
    return this.groups.create(user.id, dto);
  }

  @Get(':groupId')
  get(@CurrentUser() user: AuthUser, @Param('groupId', ID) groupId: string): Promise<GroupDetails> {
    return this.groups.get(groupId, user.id);
  }

  /** Admins and the owner can rename the group and change its details. */
  @Patch(':groupId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Body() dto: UpdateGroupDto,
  ): Promise<GroupDetails> {
    return this.groups.update(groupId, user.id, dto);
  }

  @Put(':groupId/avatar')
  @UseInterceptors(IMAGE_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @ApiBody(IMAGE_UPLOAD_BODY)
  setAvatar(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @UploadedFile() file?: UploadedImage,
  ): Promise<GroupDetails> {
    return this.groups.setAvatar(groupId, user.id, file);
  }

  /** Owner only. Archived groups are read-only. */
  @Post(':groupId/archive')
  @HttpCode(HttpStatus.OK)
  archive(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
  ): Promise<GroupDetails> {
    return this.groups.setArchived(groupId, user.id, true);
  }

  @Post(':groupId/restore')
  @HttpCode(HttpStatus.OK)
  restore(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
  ): Promise<GroupDetails> {
    return this.groups.setArchived(groupId, user.id, false);
  }

  /** Owner only: permanently deletes the group and its shared data. */
  @Delete(':groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
  ): Promise<void> {
    await this.groups.remove(groupId, user.id);
  }

  @Get(':groupId/members')
  members(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
  ): Promise<MemberView[]> {
    return this.groups.listMembers(groupId, user.id);
  }

  /** Owner only: make a member an admin or back. */
  @Patch(':groupId/members/:userId')
  changeRole(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Param('userId', ID) userId: string,
    @Body() dto: ChangeMemberRoleDto,
  ): Promise<MemberView[]> {
    return this.groups.changeRole(groupId, user.id, userId, dto.role);
  }

  /** The owner can remove anyone; admins can remove regular members. */
  @Delete(':groupId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Param('userId', ID) userId: string,
  ): Promise<void> {
    await this.groups.removeMember(groupId, user.id, userId);
  }

  @Post(':groupId/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(@CurrentUser() user: AuthUser, @Param('groupId', ID) groupId: string): Promise<void> {
    await this.groups.leave(groupId, user.id);
  }

  @Post(':groupId/transfer-ownership')
  @HttpCode(HttpStatus.OK)
  transferOwnership(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Body() dto: TransferOwnershipDto,
  ): Promise<GroupDetails> {
    return this.groups.transferOwnership(groupId, user.id, dto.userId);
  }
}
