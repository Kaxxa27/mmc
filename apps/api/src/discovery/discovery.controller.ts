import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalAuth, OptionalUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { LocaleService } from '../movies/locale.service.js';
import { type CalendarView, CalendarService } from './calendar.service.js';
import { CalendarQueryDto, HomeQueryDto } from './dto/discovery.dto.js';
import { type HomeView, HomeService } from './home.service.js';
import { type RecommendationSection, RecommendationsService } from './recommendations.service.js';

@ApiTags('Home & discovery')
@ApiBearerAuth()
@Controller()
export class DiscoveryController {
  constructor(
    private readonly home: HomeService,
    private readonly recommendations: RecommendationsService,
    private readonly calendar: CalendarService,
    private readonly locales: LocaleService,
  ) {}

  /**
   * The home page: trending, popular, top rated, now playing and upcoming movies; for signed-in
   * users also recommendations, recently added, watchlist, upcoming movie nights and group activity.
   */
  @OptionalAuth()
  @Get('home')
  async getHome(@Query() query: HomeQueryDto, @OptionalUser() user?: AuthUser): Promise<HomeView> {
    return this.home.home(user, await this.locales.resolve(user, query));
  }

  /** Personalised recommendation sections. Mark a movie "not interested" to hide it. */
  @Get('me/recommendations')
  async getRecommendations(
    @CurrentUser() user: AuthUser,
    @Query() query: HomeQueryDto,
  ): Promise<{ sections: RecommendationSection[] }> {
    return {
      sections: await this.recommendations.forUser(
        user.id,
        await this.locales.resolve(user, query),
      ),
    };
  }

  /** Viewings, movie nights in your groups and releases from your watchlist. */
  @Get('me/calendar')
  myCalendar(
    @CurrentUser() user: AuthUser,
    @Query() query: CalendarQueryDto,
  ): Promise<CalendarView> {
    return this.calendar.forUser(user.id, query);
  }

  /** Movie nights, movies watched together and releases from the group watchlist. */
  @Get('groups/:groupId/calendar')
  groupCalendar(
    @CurrentUser() user: AuthUser,
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Query() query: CalendarQueryDto,
  ): Promise<CalendarView> {
    return this.calendar.forGroup(groupId, user.id, query);
  }
}
