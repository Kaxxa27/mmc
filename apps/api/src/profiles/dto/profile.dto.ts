import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { emptyToNull, toUpperCase, trimString } from '../../common/dto/transforms.js';
import { LANGUAGE_PATTERN, REGION_PATTERN } from '../../movies/dto/movies.dto.js';

const toUsername = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() || null : value;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export class UpdateProfileDto {
  /** 3-30 characters: lowercase letters, digits and underscores. `null` removes it. */
  @IsOptional()
  @Transform(toUsername)
  @Matches(USERNAME_PATTERN, {
    message: 'username must be 3-30 lowercase letters, digits or underscores',
  })
  /** @example anna_smith */
  username?: string | null;

  /** @example Anna */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(60)
  firstName?: string | null;

  /** @example Smith */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(60)
  lastName?: string | null;

  /** @example "Animation fan and Friday-night popcorn chef." */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  /**
   * Preferred language for movie data, e.g. `en-US`.
   * @example en-US
   */
  @IsOptional()
  @Matches(LANGUAGE_PATTERN)
  language?: string;

  /**
   * Country or region (age ratings, release dates, where to watch), e.g. `US`.
   * @example US
   */
  @IsOptional()
  @Transform(toUpperCase)
  @Matches(REGION_PATTERN)
  region?: string;

  /** @example [16, 35, 10751] */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsInt({ each: true })
  favoriteGenreIds?: number[];
}

export class CompleteOnboardingDto extends UpdateProfileDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 60)
  declare firstName: string;
}

export class UsernameQueryDto {
  @Transform(toUsername)
  @Matches(USERNAME_PATTERN, {
    message: 'username must be 3-30 lowercase letters, digits or underscores',
  })
  /** @example anna_smith */
  username: string;
}

export class DeleteAccountDto {
  /**
   * A fresh sign-in code: request one with POST /auth/otp for your own address first.
   * @example "123456"
   */
  @Matches(/^\d{6}$/, { message: 'code must be the 6-digit code from the email' })
  code: string;
}
