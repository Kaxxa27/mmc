import { IsOptional } from 'class-validator';
import { IsIsoDate } from '../../common/dto/validators.js';
import { LocaleQueryDto } from '../../movies/dto/movies.dto.js';

export class CalendarQueryDto {
  /** First day (YYYY-MM-DD); defaults to the first day of the current month. */
  @IsOptional()
  @IsIsoDate()
  from?: string;

  /** Last day (YYYY-MM-DD); defaults to the last day of the `from` month. Max range: 400 days. */
  @IsOptional()
  @IsIsoDate()
  to?: string;
}

export class HomeQueryDto extends LocaleQueryDto {}
