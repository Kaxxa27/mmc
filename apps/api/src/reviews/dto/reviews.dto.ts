import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { trimString } from '../../common/dto/transforms.js';

export class UpsertReviewDto {
  /** @example "A heartwarming classic for the whole family." */
  @Transform(trimString)
  @IsString()
  @Length(1, 10_000)
  body: string;

  /**
   * Personal rating 1-10 (also updates the rating in your catalog).
   * @example 9
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number | null;

  /** @example false */
  @IsOptional()
  @IsBoolean()
  containsSpoilers?: boolean;

  /**
   * Reviews are private by default; `true` publishes it on the movie page.
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
