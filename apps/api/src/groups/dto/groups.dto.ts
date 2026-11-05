import { IntersectionType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { emptyToNull, toBoolean, toIntArray, trimString } from '../../common/dto/transforms.js';
import { IsIsoDate } from '../../common/dto/validators.js';
import {
  GROUP_KINDS,
  GROUP_MOVIE_STATUSES,
  type GroupKind,
  type GroupMovieStatus,
} from '../../database/schema/enums.js';

export class CreateGroupDto {
  /** @example "The Smiths" */
  @Transform(trimString)
  @IsString()
  @Length(1, 80)
  name: string;

  /** @example "Friday movie nights at home" */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  /**
   * `family` (default), `friends`, `couple` or `other`.
   * @example family
   */
  @IsOptional()
  @IsIn(GROUP_KINDS)
  kind?: GroupKind;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl({ protocols: ['https', 'http'], require_tld: false })
  @MaxLength(2048)
  avatarUrl?: string | null;
}

export class UpdateGroupDto {
  /** @example "The Smith Family" */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn(GROUP_KINDS)
  kind?: GroupKind;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl({ protocols: ['https', 'http'], require_tld: false })
  @MaxLength(2048)
  avatarUrl?: string | null;
}

export class ListGroupsQueryDto {
  /** Include archived groups. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived?: boolean;
}

export class ChangeMemberRoleDto {
  /** @example admin */
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member';
}

export class TransferOwnershipDto {
  @IsUUID()
  userId: string;
}

export class CreateEmailInvitationDto {
  /** @example "grandma@example.com" */
  @IsEmail()
  @MaxLength(254)
  email: string;

  /**
   * Role granted on acceptance (`admin` can only be granted by the owner).
   * @example member
   */
  @IsOptional()
  @IsIn(['admin', 'member'])
  role?: 'admin' | 'member';

  /**
   * Defaults to INVITATION_TTL_DAYS (7).
   * @example 7
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  expiresInDays?: number;
}

export class CreateLinkInvitationDto {
  /** @example member */
  @IsOptional()
  @IsIn(['admin', 'member'])
  role?: 'admin' | 'member';

  /** @example 7 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  expiresInDays?: number;

  /**
   * How many people can join with the link (unlimited by default).
   * @example 5
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses?: number;
}

export const GROUP_MOVIE_SORTS = [
  'added_desc',
  'added_asc',
  'title_asc',
  'release_desc',
  'group_rating_desc',
  'tmdb_rating_desc',
] as const;
export type GroupMovieSort = (typeof GROUP_MOVIE_SORTS)[number];

export class GroupMovieFiltersDto {
  @IsOptional()
  @IsIn(GROUP_MOVIE_STATUSES)
  status?: GroupMovieStatus;

  @IsOptional()
  @Transform(toIntArray)
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  genreIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxRuntime?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 200)
  query?: string;
}

export class ListGroupMoviesQueryDto extends IntersectionType(
  PaginationQueryDto,
  GroupMovieFiltersDto,
) {
  @IsOptional()
  @IsIn(GROUP_MOVIE_SORTS)
  sort?: GroupMovieSort;
}

export class AddGroupMovieDto {
  /** @example 354912 */
  @IsInt()
  @Min(1)
  tmdbId: number;

  /** @example "For the kids" */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class UpdateGroupMovieDto {
  /**
   * `want_to_watch` or `watched` (watched together).
   * @example watched
   */
  @IsOptional()
  @IsIn(GROUP_MOVIE_STATUSES)
  status?: GroupMovieStatus;

  /** @example 2026-11-01 */
  @IsOptional()
  @IsIsoDate()
  watchedOn?: string | null;

  /** @example "Watched together at grandma's" */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class RateGroupMovieDto {
  /** @example 8 */
  @IsInt()
  @Min(1)
  @Max(10)
  rating: number;

  /** @example "Loved the music!" */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(5000)
  review?: string | null;

  /** @example false */
  @IsOptional()
  @IsBoolean()
  containsSpoilers?: boolean;
}

export class CommentBodyDto {
  /**
   * Mention group members with `@username` to notify them.
   * @example "@anna_demo Friday works for me!"
   */
  @Transform(trimString)
  @IsString()
  @Length(1, 2000)
  body: string;
}
