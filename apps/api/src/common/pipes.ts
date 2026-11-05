import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import { badRequest } from './errors.js';

/** Parses a positive integer route parameter (e.g. TMDB ids). */
@Injectable()
export class PositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const parsed = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 1) {
      throw badRequest(
        'INVALID_PARAMETER',
        `${metadata.data ?? 'parameter'} must be a positive integer`,
      );
    }
    return parsed;
  }
}
