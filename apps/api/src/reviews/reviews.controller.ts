import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, Public } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PaginationQueryDto } from '../common/dto/pagination.dto.js';
import { PositiveIntPipe } from '../common/pipes.js';
import { UpsertReviewDto } from './dto/reviews.dto.js';
import { ReviewsService, type ReviewView } from './reviews.service.js';
import { ApiTmdbIdParam } from '../common/swagger-params.js';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Published reviews written by app users. */
  @Public()
  @Get('movies/:tmdbId/reviews')
  @ApiTmdbIdParam()
  listPublic(@Param('tmdbId', PositiveIntPipe) tmdbId: number, @Query() query: PaginationQueryDto) {
    return this.reviews.listPublic(tmdbId, query.page, query.pageSize);
  }

  @Get('me/reviews')
  listMine(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.reviews.listMine(user.id, query.page, query.pageSize);
  }

  @Get('me/reviews/:tmdbId')
  @ApiTmdbIdParam()
  getMine(
    @CurrentUser() user: AuthUser,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
  ): Promise<ReviewView> {
    return this.reviews.getMine(user.id, tmdbId);
  }

  /** Writes or edits your review (one per movie). Private unless `isPublic` is true. */
  @Put('me/reviews/:tmdbId')
  @ApiTmdbIdParam()
  async upsert(
    @CurrentUser() user: AuthUser,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
    @Body() dto: UpsertReviewDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReviewView> {
    const { review, created } = await this.reviews.upsert(user.id, tmdbId, dto);
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return review;
  }

  @Delete('me/reviews/:tmdbId')
  @ApiTmdbIdParam()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
  ): Promise<void> {
    await this.reviews.remove(user.id, tmdbId);
  }
}
