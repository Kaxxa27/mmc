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
import { type CommentView, CommentsService } from './comments.service.js';
import {
  AddGroupMovieDto,
  CommentBodyDto,
  GroupMovieFiltersDto,
  ListGroupMoviesQueryDto,
  RateGroupMovieDto,
  UpdateGroupMovieDto,
} from './dto/groups.dto.js';
import { GroupMoviesService } from './group-movies.service.js';
import type { GroupMovieDetails, GroupMovieView } from './groups.types.js';
import { ApiTmdbIdParam } from '../common/swagger-params.js';

const ID = new ParseUUIDPipe();

@ApiTags('Group catalog')
@ApiBearerAuth()
@Controller('groups/:groupId')
export class GroupMoviesController {
  constructor(
    private readonly groupMovies: GroupMoviesService,
    private readonly comments: CommentsService,
  ) {}

  /** The shared catalog with group ratings and every member's personal status. */
  @Get('movies')
  list(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Query() query: ListGroupMoviesQueryDto,
  ) {
    return this.groupMovies.list(groupId, user.id, query);
  }

  /** Random pick from the shared watchlist. */
  @Get('movies/random')
  random(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Query() filters: GroupMovieFiltersDto,
  ): Promise<GroupMovieView> {
    return this.groupMovies.random(groupId, user.id, filters);
  }

  @Post('movies')
  add(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Body() dto: AddGroupMovieDto,
  ): Promise<GroupMovieDetails> {
    return this.groupMovies.add(groupId, user.id, dto);
  }

  @Get('movies/:tmdbId')
  @ApiTmdbIdParam()
  get(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
  ): Promise<GroupMovieDetails> {
    return this.groupMovies.get(groupId, user.id, tmdbId);
  }

  /** Group status (`watched` = watched together), date and shared note. */
  @Patch('movies/:tmdbId')
  @ApiTmdbIdParam()
  update(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
    @Body() dto: UpdateGroupMovieDto,
  ): Promise<GroupMovieDetails> {
    return this.groupMovies.update(groupId, user.id, tmdbId, dto);
  }

  @Delete('movies/:tmdbId')
  @ApiTmdbIdParam()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
  ): Promise<void> {
    await this.groupMovies.remove(groupId, user.id, tmdbId);
  }

  /** Your rating (and short review) shared with the group. */
  @Put('movies/:tmdbId/rating')
  @ApiTmdbIdParam()
  rate(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
    @Body() dto: RateGroupMovieDto,
  ): Promise<GroupMovieDetails> {
    return this.groupMovies.rate(groupId, user.id, tmdbId, dto);
  }

  @Delete('movies/:tmdbId/rating')
  @ApiTmdbIdParam()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRating(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
  ): Promise<void> {
    await this.groupMovies.removeRating(groupId, user.id, tmdbId);
  }

  @Get('movies/:tmdbId/comments')
  @ApiTmdbIdParam()
  listComments(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.comments.listForMovie(groupId, user.id, tmdbId, query.page, query.pageSize);
  }

  /** Mention members with @username to notify them. */
  @Post('movies/:tmdbId/comments')
  @ApiTmdbIdParam()
  addComment(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
    @Body() dto: CommentBodyDto,
  ): Promise<CommentView> {
    return this.comments.addToMovie(groupId, user.id, tmdbId, dto.body);
  }

  @Patch('comments/:commentId')
  updateComment(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Param('commentId', ID) commentId: string,
    @Body() dto: CommentBodyDto,
  ): Promise<CommentView> {
    return this.comments.update(groupId, commentId, user.id, dto.body);
  }

  @Delete('comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeComment(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ID) groupId: string,
    @Param('commentId', ID) commentId: string,
  ): Promise<void> {
    await this.comments.remove(groupId, commentId, user.id);
  }
}
