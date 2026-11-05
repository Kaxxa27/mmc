import { applyDecorators } from '@nestjs/common';
import { IsDateString, Matches } from 'class-validator';

/** A calendar date in `YYYY-MM-DD` form that actually exists (2026-02-30 is rejected). */
export const IsIsoDate = () =>
  applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '$property must be a date in YYYY-MM-DD format' }),
    IsDateString({ strict: true }),
  );
