import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { NOTIFICATION_TYPES, type NotificationType } from '../../database/schema/enums.js';

export class ListNotificationsQueryDto extends PaginationQueryDto {
  /** Only return unread notifications. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  unreadOnly: boolean = false;
}

export class NotificationPreferenceUpdateDto {
  /** @example movie_night_decided */
  @IsIn(NOTIFICATION_TYPES)
  type: NotificationType;

  /** @example true */
  @IsOptional()
  @IsBoolean()
  inApp?: boolean;

  /** @example false */
  @IsOptional()
  @IsBoolean()
  email?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(NOTIFICATION_TYPES.length)
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceUpdateDto)
  preferences: NotificationPreferenceUpdateDto[];
}
