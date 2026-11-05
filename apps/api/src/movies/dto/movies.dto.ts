import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { toIntArray, toUpperCase, trimString } from '../../common/dto/transforms.js';
import { DISCOVER_SORTS, type DiscoverSort } from '../discover-filters.js';
import type { MovieListKind } from '../local-catalog.service.js';

export const LANGUAGE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;
export const REGION_PATTERN = /^[A-Z]{2}$/;

export class LocaleQueryDto {
  /**
   * TMDB language such as `en-US` or `de-DE` (defaults to the profile language).
   * @example en-US
   */
  @IsOptional()
  @Matches(LANGUAGE_PATTERN, { message: 'language must look like en or en-US' })
  language?: string;

  /**
   * ISO 3166-1 region such as `US` (defaults to the profile region).
   * @example US
   */
  @IsOptional()
  @Transform(toUpperCase)
  @Matches(REGION_PATTERN, { message: 'region must be a 2-letter country code' })
  region?: string;
}

export class TmdbPageQueryDto extends LocaleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  page: number = 1;
}

export const MOVIE_LISTS = ['popular', 'trending', 'top-rated', 'upcoming', 'now-playing'] as const;

export class MovieListParamsDto {
  @IsIn(MOVIE_LISTS)
  list: MovieListKind;
}

export class MovieListQueryDto extends TmdbPageQueryDto {
  /** Trending window (only for the `trending` list). */
  @IsOptional()
  @IsIn(['day', 'week'])
  window?: 'day' | 'week';
}

export class SearchQueryDto extends TmdbPageQueryDto {
  /**
   * Title, original title or alternative title (partial matches allowed).
   * @example "toy story"
   */
  @Transform(trimString)
  @IsString()
  @Length(1, 200)
  query: string;
}

export class MovieSearchQueryDto extends SearchQueryDto {
  /**
   * Release year.
   * @example 1995
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1870)
  @Max(2100)
  year?: number;
}

export class DiscoverQueryDto extends TmdbPageQueryDto {
  /** Genre ids, e.g. `35,16`. */
  @IsOptional()
  @Transform(toIntArray)
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  genreIds?: number[];

  /** `any` (default) or `all` of the genres. */
  @IsOptional()
  @IsIn(['any', 'all'])
  genreMatch?: 'any' | 'all';

  /** @example 1990 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1870)
  @Max(2100)
  yearFrom?: number;

  /** @example 2010 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1870)
  @Max(2100)
  yearTo?: number;

  /** ISO 639-1 code, e.g. `ja`. */
  @IsOptional()
  @Matches(/^[a-z]{2}$/)
  originalLanguage?: string;

  /** Country of production, e.g. `FR`. */
  @IsOptional()
  @Transform(toUpperCase)
  @Matches(REGION_PATTERN)
  originCountry?: string;

  /** @example 7 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  minRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRating?: number;

  /** Minimum number of TMDB votes (a popularity floor). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minVotes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  minRuntime?: number;

  /** @example 120 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  maxRuntime?: number;

  /** Country whose age ratings `maxCertification` refers to (default `US`). */
  @IsOptional()
  @Transform(toUpperCase)
  @Matches(REGION_PATTERN)
  certificationCountry?: string;

  /**
   * Highest allowed age rating, e.g. `PG-13`.
   * @example PG
   */
  @IsOptional()
  @IsString()
  @Length(1, 10)
  maxCertification?: string;

  /** TMDB person ids of actors (all must appear). */
  @IsOptional()
  @Transform(toIntArray)
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  castIds?: number[];

  /** TMDB person ids of crew members such as directors. */
  @IsOptional()
  @Transform(toIntArray)
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  crewIds?: number[];

  @IsOptional()
  @IsIn(['released', 'upcoming'])
  releaseState?: 'released' | 'upcoming';

  @IsOptional()
  @IsIn(DISCOVER_SORTS)
  sort?: DiscoverSort;
}
