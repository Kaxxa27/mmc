import { IntersectionType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { emptyToNull, toBoolean, toIntArray, trimString } from '../../common/dto/transforms.js';
import { IsIsoDate } from '../../common/dto/validators.js';
import { MOVIE_STATUSES, type MovieStatus } from '../../database/schema/enums.js';

export const LIBRARY_SORTS = [
  'added_desc',
  'added_asc',
  'title_asc',
  'title_desc',
  'release_desc',
  'release_asc',
  'rating_desc',
  'rating_asc',
  'tmdb_rating_desc',
  'popularity_desc',
  'watched_desc',
  'runtime_asc',
  'runtime_desc',
] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

const toStatusArray = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === '') return undefined;
  const parts: unknown[] = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [value];
  return parts.map((part) => (typeof part === 'string' ? part.trim() : part));
};

export class LibraryFiltersDto {
  /** One or more statuses, e.g. `want_to_watch,watching`. `not_interested` is hidden unless requested. */
  @IsOptional()
  @Transform(toStatusArray)
  @IsArray()
  @IsIn(MOVIE_STATUSES, { each: true })
  status?: MovieStatus[];

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  favorite?: boolean;

  @IsOptional()
  @Transform(toIntArray)
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  genreIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1870)
  @Max(2100)
  yearFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1870)
  @Max(2100)
  yearTo?: number;

  /**
   * Minimum personal rating (1-10).
   * @example 7
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  minRating?: number;

  /** Maximum personal rating (1-10). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxRating?: number;

  /**
   * Maximum runtime in minutes.
   * @example 120
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxRuntime?: number;

  /**
   * Search within the catalog by title.
   * @example toy
   */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 200)
  query?: string;
}

export class ListLibraryQueryDto extends IntersectionType(PaginationQueryDto, LibraryFiltersDto) {
  @IsOptional()
  @IsIn(LIBRARY_SORTS)
  sort?: LibrarySort;
}

export class UpsertLibraryEntryDto {
  /**
   * Viewing status; `null` keeps the movie saved without a status.
   * @example watched
   */
  @IsOptional()
  @IsIn([...MOVIE_STATUSES, null])
  status?: MovieStatus | null;

  /** @example true */
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  /**
   * Personal rating 1-10, or `null` to clear. Stored separately from TMDB ratings.
   * @example 9
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number | null;

  /**
   * Private notes (never visible to anyone else). Empty string clears them.
   * @example "Watch with the kids at Christmas"
   */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  /**
   * Logs a viewing on this date (YYYY-MM-DD) and marks the movie as watched.
   * @example 2026-11-01
   */
  @IsOptional()
  @IsIsoDate()
  watchedOn?: string;

  /** When marking as watched without `watchedOn`, log a viewing today (default true). */
  @IsOptional()
  @IsBoolean()
  logViewing?: boolean;
}

export class RemoveLibraryEntryQueryDto {
  /** Also delete the viewing history of the movie. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeHistory?: boolean;
}

export class HistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIsoDate()
  from?: string;

  @IsOptional()
  @IsIsoDate()
  to?: string;
}

export class CreateWatchEventDto {
  /** @example 862 */
  @IsInt()
  @Min(1)
  tmdbId: number;

  /**
   * Defaults to today.
   * @example 2026-11-01
   */
  @IsOptional()
  @IsIsoDate()
  watchedOn?: string;

  /** @example 9 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number;

  /** @example "Rewatched on a rainy Sunday" */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  /** Defaults to true when the movie was logged before. */
  @IsOptional()
  @IsBoolean()
  isRewatch?: boolean;
}

export class UpdateWatchEventDto {
  /** @example 2026-10-31 */
  @IsOptional()
  @IsIsoDate()
  watchedOn?: string;

  /** @example 8 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isRewatch?: boolean;
}
