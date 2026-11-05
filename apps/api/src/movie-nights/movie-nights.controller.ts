import { ApiTmdbIdParam } from '../common/swagger-params.js';
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PaginationQueryDto } from '../common/dto/pagination.dto.js';
import { PositiveIntPipe } from '../common/pipes.js';
import { type CommentView, CommentsService } from '../groups/comments.service.js';
import { CommentBodyDto } from '../groups/dto/groups.dto.js';
import type { WatchEventView } from '../library/library.types.js';
import {
  AddCandidatesDto,
  AddSuggestedCandidatesDto,
  CloseVotingDto,
  CreateMovieNightDto,
  ListMovieNightsQueryDto,
  LogMovieNightViewingDto,
  SelectMovieDto,
  SuggestionsQueryDto,
  UpdateMovieNightDto,
  VoteDto,
} from './dto/movie-nights.dto.js';
import {
  type MovieNightDetails,
  MovieNightsService,
  type SuggestionView,
} from './movie-nights.service.js';

const ID = new ParseUUIDPipe();

@ApiTags('Movie nights')
@ApiBearerAuth()
@Controller()
export class MovieNightsController {
  constructor(
    private readonly nights: MovieNightsService,
    private readonly comments: CommentsService,
  ) {}

  /** Upcoming and past movie nights of a group (history includes results). */
  @Get('groups/:groupId/movie-nights')
  list(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Query() query: ListMovieNightsQueryDto,
  ) {
    return this.nights.list(groupId, user.id, query);
  }

  /** Plans a movie night: date, participants and criteria (genres, rating, runtime, age). */
  @Post('groups/:groupId/movie-nights')
  create(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Body() dto: CreateMovieNightDto,
  ): Promise<MovieNightDetails> {
    return this.nights.create(groupId, user.id, dto);
  }

  @Get('movie-nights/:movieNightId')
  get(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
  ): Promise<MovieNightDetails> {
    return this.nights.get(id, user.id);
  }

  @Patch('movie-nights/:movieNightId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
    @Body() dto: UpdateMovieNightDto,
  ): Promise<MovieNightDetails> {
    return this.nights.update(id, user.id, dto);
  }

  @Delete('movie-nights/:movieNightId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
  ): Promise<void> {
    await this.nights.remove(id, user.id);
  }

  /** Shortlist from the shared watchlist that matches the criteria, best first. */
  @Get('movie-nights/:movieNightId/suggestions')
  suggestions(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
    @Query() query: SuggestionsQueryDto,
  ): Promise<SuggestionView[]> {
    return this.nights.suggestions(id, user.id, query.limit);
  }

  @Post('movie-nights/:movieNightId/candidates')
  addCandidates(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
    @Body() dto: AddCandidatesDto,
  ): Promise<MovieNightDetails> {
    return this.nights.addCandidates(id, user.id, dto.tmdbIds);
  }

  /** Adds the top suggestions as candidates. */
  @Post('movie-nights/:movieNightId/candidates/suggested')
  addSuggested(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
    @Body() dto: AddSuggestedCandidatesDto,
  ): Promise<MovieNightDetails> {
    return this.nights.addSuggestedCandidates(id, user.id, dto.limit);
  }

  @Delete('movie-nights/:movieNightId/candidates/:tmdbId')
  @ApiTmdbIdParam()
  removeCandidate(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
  ): Promise<MovieNightDetails> {
    return this.nights.removeCandidate(id, user.id, tmdbId);
  }

  @Post('movie-nights/:movieNightId/voting/start')
  @HttpCode(HttpStatus.OK)
  startVoting(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
  ): Promise<MovieNightDetails> {
    return this.nights.startVoting(id, user.id);
  }

  /** Your vote (one per participant, can be changed until voting closes). */
  @Put('movie-nights/:movieNightId/vote')
  vote(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
    @Body() dto: VoteDto,
  ): Promise<MovieNightDetails> {
    return this.nights.vote(id, user.id, dto.tmdbId);
  }

  @Delete('movie-nights/:movieNightId/vote')
  withdrawVote(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
  ): Promise<MovieNightDetails> {
    return this.nights.withdrawVote(id, user.id);
  }

  /** Organiser: closes voting and selects the winner. */
  @Post('movie-nights/:movieNightId/voting/close')
  @HttpCode(HttpStatus.OK)
  closeVoting(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
    @Body() dto: CloseVotingDto,
  ): Promise<MovieNightDetails> {
    return this.nights.closeVoting(id, user.id, dto.tieBreakerTmdbId);
  }

  /** Random movie picker: a random candidate (or a random match from the shortlist). */
  @Post('movie-nights/:movieNightId/pick-random')
  @HttpCode(HttpStatus.OK)
  pickRandom(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
  ): Promise<MovieNightDetails> {
    return this.nights.pickRandom(id, user.id);
  }

  @Post('movie-nights/:movieNightId/select')
  @HttpCode(HttpStatus.OK)
  select(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
    @Body() dto: SelectMovieDto,
  ): Promise<MovieNightDetails> {
    return this.nights.select(id, user.id, dto.tmdbId);
  }

  /** Marks the night as done; the movie becomes "watched together" in the shared catalog. */
  @Post('movie-nights/:movieNightId/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
  ): Promise<MovieNightDetails> {
    return this.nights.complete(id, user.id);
  }

  /** Adds this movie night to your personal viewing history. */
  @Post('movie-nights/:movieNightId/log-viewing')
  logViewing(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
    @Body() dto: LogMovieNightViewingDto,
  ): Promise<WatchEventView> {
    return this.nights.logViewing(id, user.id, dto);
  }

  @Post('movie-nights/:movieNightId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
  ): Promise<MovieNightDetails> {
    return this.nights.cancel(id, user.id);
  }

  @Get('movie-nights/:movieNightId/comments')
  listComments(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.comments.listForMovieNight(id, user.id, query.page, query.pageSize);
  }

  @Post('movie-nights/:movieNightId/comments')
  addComment(
    @CurrentUser() user: AuthUser,
    @Param('movieNightId', ID) id: string,
    @Body() dto: CommentBodyDto,
  ): Promise<CommentView> {
    return this.comments.addToMovieNight(id, user.id, dto.body);
  }
}
