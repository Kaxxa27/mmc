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
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  ListNotificationsQueryDto,
  UpdateNotificationPreferencesDto,
} from './dto/notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('me')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  list(@CurrentUser() user: AuthUser, @Query() query: ListNotificationsQueryDto) {
    return this.notifications.list(user.id, query);
  }

  @Get('notifications/unread-count')
  async unreadCount(@CurrentUser() user: AuthUser): Promise<{ unreadCount: number }> {
    return { unreadCount: await this.notifications.unreadCount(user.id) };
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@CurrentUser() user: AuthUser): Promise<{ updated: number }> {
    return { updated: await this.notifications.markAllRead(user.id) };
  }

  @Post('notifications/:notificationId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @CurrentUser() user: AuthUser,
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
  ): Promise<void> {
    await this.notifications.markRead(user.id, notificationId);
  }

  @Delete('notifications/:notificationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
  ): Promise<void> {
    await this.notifications.remove(user.id, notificationId);
  }

  /** Effective in-app / email settings for every notification type. */
  @Get('notification-preferences')
  async getPreferences(@CurrentUser() user: AuthUser) {
    return { preferences: await this.notifications.getPreferences(user.id) };
  }

  @Put('notification-preferences')
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return { preferences: await this.notifications.updatePreferences(user.id, dto.preferences) };
  }
}
