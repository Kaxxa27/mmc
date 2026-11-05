import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { emptyToNull, trimString } from '../../common/dto/transforms.js';
import { COLLECTION_VISIBILITIES, type CollectionVisibility } from '../../database/schema/enums.js';

export class CreateCollectionDto {
  /** @example "Christmas Movies" */
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  name: string;

  /** @example "Our December favorites" */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl({ protocols: ['https', 'http'], require_tld: false })
  @MaxLength(2048)
  coverImageUrl?: string | null;

  /**
   * `private` (default for personal collections), `shared` or `public` (anyone with the link).
   * @example private
   */
  @IsOptional()
  @IsIn(COLLECTION_VISIBILITIES)
  visibility?: CollectionVisibility;

  /** Create the collection inside a group (editable by all members). */
  @IsOptional()
  @IsUUID()
  groupId?: string;
}

export class UpdateCollectionDto {
  /** @example "Christmas Classics" */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl({ protocols: ['https', 'http'], require_tld: false })
  @MaxLength(2048)
  coverImageUrl?: string | null;

  /** @example public */
  @IsOptional()
  @IsIn(COLLECTION_VISIBILITIES)
  visibility?: CollectionVisibility;
}

export class ListCollectionsQueryDto extends PaginationQueryDto {
  /** `mine` (default), `shared` (shared with me) or `group` (requires `groupId`). */
  @IsOptional()
  @IsIn(['mine', 'shared', 'group'])
  scope: 'mine' | 'shared' | 'group' = 'mine';

  @ValidateIf((dto: ListCollectionsQueryDto) => dto.scope === 'group')
  @IsUUID()
  groupId?: string;
}

export class AddCollectionItemDto {
  /** @example 10719 */
  @IsInt()
  @Min(1)
  tmdbId: number;

  /** @example "Perfect for Christmas Eve" */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class ReorderCollectionDto {
  /**
   * TMDB ids in the desired order; movies not listed keep their order after these.
   * @example [508965, 10719, 771]
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsInt({ each: true })
  tmdbIds: number[];
}

export class ShareCollectionDto {
  /** Share with every member of one of your groups... */
  @ValidateIf((dto: ShareCollectionDto) => dto.username === undefined)
  @IsUUID()
  groupId?: string;

  /**
   * ...or with one person, by username.
   * @example ben_demo
   */
  @ValidateIf((dto: ShareCollectionDto) => dto.groupId === undefined)
  @Matches(/^[a-z0-9_]{3,30}$/)
  username?: string;
}
