import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionalAuth, OptionalUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PositiveIntPipe } from '../common/pipes.js';
import { LocaleQueryDto, SearchQueryDto } from './dto/movies.dto.js';
import { LocaleService } from './locale.service.js';
import type { PersonDetails } from './movie.types.js';
import { PeopleService } from './people.service.js';

@ApiTags('People')
@OptionalAuth()
@Controller('people')
export class PeopleController {
  constructor(
    private readonly people: PeopleService,
    private readonly locales: LocaleService,
  ) {}

  /** Search actors, directors and other crew by name. */
  @Get('search')
  async search(@Query() query: SearchQueryDto, @OptionalUser() user?: AuthUser) {
    const { language } = await this.locales.resolve(user, query);
    return this.people.search(query.query, query.page, language);
  }

  /** Biography and filmography (acting, directing, writing, producing). */
  @Get(':personId')
  async details(
    @Param('personId', PositiveIntPipe) personId: number,
    @Query() query: LocaleQueryDto,
    @OptionalUser() user?: AuthUser,
  ): Promise<PersonDetails> {
    const { language } = await this.locales.resolve(user, query);
    return this.people.details(personId, language);
  }
}
