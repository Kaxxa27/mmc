import { ApiParam } from '@nestjs/swagger';

/** Documents a `:tmdbId` path parameter with a ready-to-use example (Toy Story). */
export const ApiTmdbIdParam = () =>
  ApiParam({
    name: 'tmdbId',
    type: Number,
    example: 862,
    description: 'TMDB movie id, e.g. 862 (Toy Story), 354912 (Coco), 129 (Spirited Away).',
  });
