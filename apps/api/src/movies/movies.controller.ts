import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OptionalAuth, OptionalUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PositiveIntPipe } from '../common/pipes.js';
import {
  DiscoverQueryDto,
  LocaleQueryDto,
  MovieListParamsDto,
  MovieListQueryDto,
  MovieSearchQueryDto,
  TmdbPageQueryDto,
} from './dto/movies.dto.js';
import { LocaleService } from './locale.service.js';
import type { MovieDetails, MovieListResult } from './movie.types.js';
import { MoviesService } from './movies.service.js';
import { ApiTmdbIdParam } from '../common/swagger-params.js';

/** Global movie database. Works for guests; signed-in users also get their status per movie. */
@ApiTags('Movies')
@ApiBearerAuth()
@OptionalAuth()
@Controller('movies')
export class MoviesController {
  constructor(
    private readonly movies: MoviesService,
    private readonly locales: LocaleService,
  ) {}

  /** Popular, trending, top rated, upcoming or now playing movies. */
  @Get('lists/:list')
  async list(
    @Param() params: MovieListParamsDto,
    @Query() query: MovieListQueryDto,
    @OptionalUser() user?: AuthUser,
  ): Promise<MovieListResult> {
    const locale = await this.locales.resolve(user, query);
    return this.movies.list(params.list, {
      page: query.page,
      locale,
      window: query.window,
      userId: user?.id,
    });
  }

  /** Search by title (original and alternative titles included), optionally by year. */
  @Get('search')
  async search(
    @Query() query: MovieSearchQueryDto,
    @OptionalUser() user?: AuthUser,
  ): Promise<MovieListResult> {
    const locale = await this.locales.resolve(user, query);
    return this.movies.search({
      query: query.query,
      year: query.year,
      page: query.page,
      locale,
      userId: user?.id,
    });
  }

  /** Advanced search: combine genre, year, language, country, rating, runtime, age rating, cast and crew. */
  @Get('discover')
  async discover(
    @Query() query: DiscoverQueryDto,
    @OptionalUser() user?: AuthUser,
  ): Promise<MovieListResult> {
    const { page, language, region, ...filters } = query;
    const locale = await this.locales.resolve(user, { language, region });
    return this.movies.discover(filters, { page, locale, userId: user?.id });
  }

  @Get(':tmdbId/similar')
  @ApiTmdbIdParam()
  async similar(
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
    @Query() query: TmdbPageQueryDto,
    @OptionalUser() user?: AuthUser,
  ): Promise<MovieListResult> {
    const locale = await this.locales.resolve(user, query);
    return this.movies.similar(tmdbId, { page: query.page, locale, userId: user?.id });
  }

  /** Full details: cast and crew, trailers, age ratings, similar titles and where to watch. */
  @Get(':tmdbId')
  @ApiTmdbIdParam()
  async details(
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
    @Query() query: LocaleQueryDto,
    @OptionalUser() user?: AuthUser,
  ): Promise<MovieDetails> {
    const locale = await this.locales.resolve(user, query);
    return this.movies.details(tmdbId, { locale, userId: user?.id });
  }
}
