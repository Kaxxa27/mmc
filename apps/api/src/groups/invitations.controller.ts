import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CreateEmailInvitationDto, CreateLinkInvitationDto } from './dto/groups.dto.js';
import {
  type CreatedLinkInvitation,
  type InvitationPreview,
  type InvitationView,
  InvitationsService,
  type MyInvitationView,
} from './invitations.service.js';

const ID = new ParseUUIDPipe();

@ApiTags('Group invitations')
@ApiBearerAuth()
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  /** Admins: invite someone by email. They accept with that address (signing up if needed). */
  @Post('groups/:groupId/invitations')
  inviteByEmail(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Body() dto: CreateEmailInvitationDto,
  ): Promise<InvitationView> {
    return this.invitations.inviteByEmail(groupId, user.id, dto);
  }

  /** Admins: create a shareable invitation link (the token is shown only once). */
  @Post('groups/:groupId/invitation-links')
  createLink(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Body() dto: CreateLinkInvitationDto,
  ): Promise<CreatedLinkInvitation> {
    return this.invitations.createLink(groupId, user.id, dto);
  }

  @Get('groups/:groupId/invitations')
  list(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
  ): Promise<InvitationView[]> {
    return this.invitations.list(groupId, user.id);
  }

  @Delete('groups/:groupId/invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Param('invitationId', ID) invitationId: string,
  ): Promise<void> {
    await this.invitations.revoke(groupId, user.id, invitationId);
  }

  /** Public: what an invitation link is for (shown before signing in). */
  @Public()
  @Get('invitations/:token')
  preview(@Param('token') token: string): Promise<InvitationPreview> {
    return this.invitations.preview(token);
  }

  /** Joins the group. Email invitations require the invited address. */
  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.invitations.acceptByToken(token, user);
  }

  /** Pending email invitations for your address. */
  @Get('me/invitations')
  mine(@CurrentUser() user: AuthUser): Promise<MyInvitationView[]> {
    return this.invitations.listForUser(user);
  }

  @Post('me/invitations/:invitationId/accept')
  @HttpCode(HttpStatus.OK)
  acceptMine(@CurrentUser() user: AuthUser, @Param('invitationId', ID) invitationId: string) {
    return this.invitations.acceptById(invitationId, user);
  }

  @Post('me/invitations/:invitationId/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  async declineMine(
    @CurrentUser() user: AuthUser,
    @Param('invitationId', ID) invitationId: string,
  ): Promise<void> {
    await this.invitations.declineById(invitationId, user);
  }
}
