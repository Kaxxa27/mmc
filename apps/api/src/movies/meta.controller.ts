import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OptionalAuth, OptionalUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { AppConfig } from '../config/app-config.js';
import {
  COLLECTION_VISIBILITIES,
  GROUP_KINDS,
  GROUP_ROLES,
  MOVIE_STATUSES,
  NOTIFICATION_TYPES,
} from '../database/schema/enums.js';
import { CERTIFICATION_SCALES } from './certifications.js';
import { DISCOVER_SORTS } from './discover-filters.js';
import { LocaleQueryDto, SearchQueryDto } from './dto/movies.dto.js';
import { GenresService } from './genres.service.js';
import { LocaleService } from './locale.service.js';
import { MoviesService } from './movies.service.js';
import { PeopleService } from './people.service.js';
import type { PersonSummary } from './movie.types.js';

@ApiTags('Catalog metadata')
@ApiBearerAuth()
@OptionalAuth()
@Controller()
export class MetaController {
  constructor(
    private readonly config: AppConfig,
    private readonly genres: GenresService,
    private readonly locales: LocaleService,
    private readonly movies: MoviesService,
    private readonly people: PeopleService,
  ) {}

  /** Movie genres in the requested language. */
  @Get('genres')
  async listGenres(@Query() query: LocaleQueryDto, @OptionalUser() user?: AuthUser) {
    const { language } = await this.locales.resolve(user, query);
    return { genres: await this.genres.list(language) };
  }

  /** Static configuration for clients: image URLs, enums, age-rating scales, attribution. */
  @Get('config')
  getConfig() {
    const { mode, imageBaseUrl, defaultLanguage, defaultRegion } = this.config.tmdb;
    return {
      movieData: {
        provider: 'TMDB',
        /** `live` (real TMDB), `mock` (built-in test data) or `offline` (local catalog only). */
        mode,
        attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
        attributionUrl: 'https://www.themoviedb.org/',
        imageBaseUrl,
        posterSizes: ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'],
        backdropSizes: ['w300', 'w780', 'w1280', 'original'],
        profileSizes: ['w45', 'w185', 'h632', 'original'],
      },
      defaults: { language: defaultLanguage, region: defaultRegion },
      /** Optional features clients can offer (developer tools exist only in development). */
      features: {
        devTools: this.config.devTools.enabled,
        demoAccounts: this.config.demoAccounts.enabled,
      },
      enums: {
        movieStatuses: MOVIE_STATUSES,
        groupRoles: GROUP_ROLES,
        groupKinds: GROUP_KINDS,
        collectionVisibilities: COLLECTION_VISIBILITIES,
        notificationTypes: NOTIFICATION_TYPES,
        discoverSorts: DISCOVER_SORTS,
      },
      certificationScales: CERTIFICATION_SCALES,
    };
  }

  /** One search box: matching movies plus matching people (actors, directors). */
  @Get('search')
  async search(@Query() query: SearchQueryDto, @OptionalUser() user?: AuthUser) {
    const locale = await this.locales.resolve(user, query);
    const movies = await this.movies.search({
      query: query.query,
      page: query.page,
      locale,
      userId: user?.id,
    });
    let people: PersonSummary[] = [];
    if (this.config.tmdb.enabled && query.page === 1) {
      try {
        people = (await this.people.search(query.query, 1, locale.language)).items.slice(0, 6);
      } catch {
        people = [];
      }
    }
    return { movies, people };
  }
}
