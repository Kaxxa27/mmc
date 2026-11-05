import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { emptyToNull, toUpperCase, trimString } from '../../common/dto/transforms.js';
import { IsIsoDate } from '../../common/dto/validators.js';
import { MOVIE_NIGHT_STATUSES, type MovieNightStatus } from '../../database/schema/enums.js';
import type { WatchedFilter } from '../../database/schema/movie-nights.js';

export class MovieNightCriteriaDto {
  /**
   * Any of these genres (e.g. comedy or animation).
   * @example [16, 35, 10751]
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  genreIds?: number[];

  /**
   * Minimum TMDB rating, e.g. 7.
   * @example 7
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  minRating?: number;

  /**
   * Maximum runtime in minutes, e.g. 120.
   * @example 120
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  maxRuntime?: number;

  /**
   * Highest allowed age rating, e.g. `PG`.
   * @example PG
   */
  @IsOptional()
  @IsString()
  @Length(1, 10)
  maxCertification?: string;

  /** @example US */
  @IsOptional()
  @Transform(toUpperCase)
  @Matches(/^[A-Z]{2}$/)
  certificationCountry?: string;

  /**
   * `all` (default): skip movies every participant saw; `any`: skip if anyone saw it; `none`.
   * @example all
   */
  @IsOptional()
  @IsIn(['any', 'all', 'none'])
  excludeWatchedBy?: WatchedFilter;

  /** Also suggest movies from participants' personal watchlists. */
  @IsOptional()
  @IsBoolean()
  includeParticipantWatchlists?: boolean;
}

export class CreateMovieNightDto {
  /** @example "Friday Movie Night" */
  @Transform(trimString)
  @IsString()
  @Length(1, 120)
  title: string;

  /** @example "Pizza at 7, movie at 8" */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  /**
   * ISO 8601 date-time, e.g. `2026-11-06T19:30:00+01:00`.
   * @example 2026-11-06T19:00:00Z
   */
  @IsOptional()
  @IsISO8601({ strict: true })
  scheduledAt?: string;

  /** Group members taking part (defaults to everyone in the group). */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  participantIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => MovieNightCriteriaDto)
  criteria?: MovieNightCriteriaDto;
}

export class UpdateMovieNightDto {
  /** @example "Saturday Movie Night" */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 120)
  title?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  /** @example 2026-11-07T19:00:00Z */
  @IsOptional()
  @IsISO8601({ strict: true })
  scheduledAt?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  participantIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => MovieNightCriteriaDto)
  criteria?: MovieNightCriteriaDto;
}

export class ListMovieNightsQueryDto extends PaginationQueryDto {
  /** `upcoming`, `past` (history) or `all` (default). */
  @IsOptional()
  @IsIn(['upcoming', 'past', 'all'])
  when: 'upcoming' | 'past' | 'all' = 'all';

  @IsOptional()
  @IsIn(MOVIE_NIGHT_STATUSES)
  status?: MovieNightStatus;
}

export class SuggestionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}

export class AddCandidatesDto {
  /** @example [862, 354912] */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  tmdbIds: number[];
}

export class AddSuggestedCandidatesDto {
  /**
   * How many top suggestions to add (default 5).
   * @example 3
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class VoteDto {
  /** @example 354912 */
  @IsInt()
  @Min(1)
  tmdbId: number;
}

export class CloseVotingDto {
  /**
   * Used only when the vote is tied (must be one of the tied movies).
   * @example 354912
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  tieBreakerTmdbId?: number;
}

export class SelectMovieDto {
  /** @example 862 */
  @IsInt()
  @Min(1)
  tmdbId: number;
}

export class LogMovieNightViewingDto {
  /** @example 9 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number;

  /** Defaults to the movie night date (or today). */
  @IsOptional()
  @IsIsoDate()
  watchedOn?: string;
}
