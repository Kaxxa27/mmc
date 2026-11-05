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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalAuth, OptionalUser, Public } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PositiveIntPipe } from '../common/pipes.js';
import type { UploadedImage } from '../media/media.service.js';
import { IMAGE_UPLOAD, IMAGE_UPLOAD_BODY } from '../profiles/profiles.controller.js';
import type { CollectionDetails, CollectionShareView } from './collections.types.js';
import { CollectionsService } from './collections.service.js';
import {
  AddCollectionItemDto,
  CreateCollectionDto,
  ListCollectionsQueryDto,
  ReorderCollectionDto,
  ShareCollectionDto,
  UpdateCollectionDto,
} from './dto/collections.dto.js';

const ID = new ParseUUIDPipe();

@ApiTags('Collections')
@ApiBearerAuth()
@Controller()
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  /** Your collections (`mine`), collections shared with you, or a group's collections. */
  @Get('collections')
  list(@CurrentUser() user: AuthUser, @Query() query: ListCollectionsQueryDto) {
    return this.collections.list(user.id, query);
  }

  @Post('collections')
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCollectionDto,
  ): Promise<CollectionDetails> {
    return this.collections.create(user.id, dto);
  }

  /** A collection you can access (own, group, shared with you or public). */
  @OptionalAuth()
  @Get('collections/:collectionId')
  get(
    @Param('collectionId', ID) collectionId: string,
    @OptionalUser() user?: AuthUser,
  ): Promise<CollectionDetails> {
    return this.collections.get(collectionId, user?.id);
  }

  /** Public collections, viewable by anyone with the link (no sign-in). */
  @Public()
  @Get('public/collections/:collectionId')
  getPublic(@Param('collectionId', ID) collectionId: string): Promise<CollectionDetails> {
    return this.collections.get(collectionId, undefined);
  }

  @Patch('collections/:collectionId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('collectionId', ID) collectionId: string,
    @Body() dto: UpdateCollectionDto,
  ): Promise<CollectionDetails> {
    return this.collections.update(collectionId, user.id, dto);
  }

  @Delete('collections/:collectionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('collectionId', ID) collectionId: string,
  ): Promise<void> {
    await this.collections.remove(collectionId, user.id);
  }

  /** Uploads a cover image (PNG, JPEG or WebP, up to 2 MB). */
  @Put('collections/:collectionId/cover')
  @UseInterceptors(IMAGE_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @ApiBody(IMAGE_UPLOAD_BODY)
  setCover(
    @CurrentUser() user: AuthUser,
    @Param('collectionId', ID) collectionId: string,
    @UploadedFile() file?: UploadedImage,
  ): Promise<CollectionDetails> {
    return this.collections.setCover(collectionId, user.id, file);
  }

  @Post('collections/:collectionId/items')
  addItem(
    @CurrentUser() user: AuthUser,
    @Param('collectionId', ID) collectionId: string,
    @Body() dto: AddCollectionItemDto,
  ): Promise<CollectionDetails> {
    return this.collections.addItem(collectionId, user.id, dto);
  }

  @Delete('collections/:collectionId/items/:tmdbId')
  @ApiTmdbIdParam()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItem(
    @CurrentUser() user: AuthUser,
    @Param('collectionId', ID) collectionId: string,
    @Param('tmdbId', PositiveIntPipe) tmdbId: number,
  ): Promise<void> {
    await this.collections.removeItem(collectionId, user.id, tmdbId);
  }

  @Put('collections/:collectionId/items/order')
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('collectionId', ID) collectionId: string,
    @Body() dto: ReorderCollectionDto,
  ): Promise<CollectionDetails> {
    return this.collections.reorder(collectionId, user.id, dto.tmdbIds);
  }

  @Get('collections/:collectionId/shares')
  listShares(
    @CurrentUser() user: AuthUser,
    @Param('collectionId', ID) collectionId: string,
  ): Promise<CollectionShareView[]> {
    return this.collections.listShares(collectionId, user.id);
  }

  /** Shares a personal collection with one of your groups or a user (by username). */
  @Post('collections/:collectionId/shares')
  share(
    @CurrentUser() user: AuthUser,
    @Param('collectionId', ID) collectionId: string,
    @Body() dto: ShareCollectionDto,
  ): Promise<CollectionShareView[]> {
    return this.collections.share(collectionId, user.id, dto);
  }

  @Delete('collections/:collectionId/shares/:shareId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unshare(
    @CurrentUser() user: AuthUser,
    @Param('collectionId', ID) collectionId: string,
    @Param('shareId', ID) shareId: string,
  ): Promise<void> {
    await this.collections.unshare(collectionId, user.id, shareId);
  }
}
