import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PositiveIntPipe } from '../common/pipes.js';
import {
  CreateWatchEventDto,
  HistoryQueryDto,
  LibraryFiltersDto,
  ListLibraryQueryDto,
  RemoveLibraryEntryQueryDto,
  UpdateWatchEventDto,
  UpsertLibraryEntryDto,
} from './dto/library.dto.js';
import { LibraryService } from './library.service.js';
import type { DefaultList, LibraryEntry, LibraryStats, WatchEventView } from './library.types.js';
import { ApiTmdbIdParam } from '../common/swagger-params.js';

@ApiTags('My catalog')
@ApiBearerAuth()
@Controller('me')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  /** Personal catalog with filters (status, favorite, genre, year, rating, runtime, title) and sorting. */
  @Get('movies')
  list(@CurrentUser() user: AuthUser, @Query() query: ListLibraryQueryDto) {
    return this.library.list(user.id, query);
  }

  /** Random movie from the catalog (watchlist by default) — the random movie picker. */
  @Get('movies/random')
  random(
    @CurrentUser() user: AuthUser,
    @Query() filters: LibraryFiltersDto,
  ): Promise<LibraryEntry> {
    return this.library.random(user.id, filters);
  }

  @Get('movies/:tmdbId')
  @ApiTmdbIdParam()
  get(
    @CurrentUser() user: AuthUser,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
  ): Promise<LibraryEntry> {
    return this.library.get(user.id, tmdbId);
  }

  /**
   * Adds a movie to the catalog or changes it: status, favorite, personal rating, private notes.
   * Responds 201 when the movie was added, 200 when it was updated.
   */
  @Put('movies/:tmdbId')
  @ApiTmdbIdParam()
  async upsert(
    @CurrentUser() user: AuthUser,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
    @Body() dto: UpsertLibraryEntryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LibraryEntry> {
    const { entry, created } = await this.library.upsert(user.id, tmdbId, dto);
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return entry;
  }

  @Delete('movies/:tmdbId')
  @ApiTmdbIdParam()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
    @Query() query: RemoveLibraryEntryQueryDto,
  ): Promise<void> {
    await this.library.remove(user.id, tmdbId, query.includeHistory);
  }

  /** Built-in lists with counts and poster previews. */
  @Get('lists')
  async lists(@CurrentUser() user: AuthUser): Promise<{ lists: DefaultList[] }> {
    return { lists: await this.library.defaultLists(user.id) };
  }

  /** Viewing history, newest first. */
  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query() query: HistoryQueryDto) {
    return this.library.history(user.id, query);
  }

  /** Logs a viewing (rewatches create new entries). */
  @Post('history')
  logViewing(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWatchEventDto,
  ): Promise<WatchEventView> {
    return this.library.logViewing(user.id, dto);
  }

  @Patch('history/:eventId')
  updateViewing(
    @CurrentUser() user: AuthUser,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body() dto: UpdateWatchEventDto,
  ): Promise<WatchEventView> {
    return this.library.updateViewing(user.id, eventId, dto);
  }

  @Delete('history/:eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteViewing(
    @CurrentUser() user: AuthUser,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<void> {
    await this.library.deleteViewing(user.id, eventId);
  }

  /** Statistics computed from the user's own activity. */
  @Get('stats')
  stats(@CurrentUser() user: AuthUser): Promise<LibraryStats> {
    return this.library.stats(user.id);
  }
}
