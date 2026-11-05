import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, type ApiBodyOptions, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Client, CurrentUser } from '../auth/auth.decorators.js';
import type { AuthUser, ClientContext } from '../auth/auth.types.js';
import { MAX_IMAGE_BYTES, type UploadedImage } from '../media/media.service.js';
import { AccountService } from './account.service.js';
import {
  CompleteOnboardingDto,
  DeleteAccountDto,
  UpdateProfileDto,
  UsernameQueryDto,
} from './dto/profile.dto.js';
import { ProfilesService, type ProfileView } from './profiles.service.js';

export const IMAGE_UPLOAD = FileInterceptor('file', {
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});
export const IMAGE_UPLOAD_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
    required: ['file'],
  },
};

@ApiTags('Profile & account')
@ApiBearerAuth()
@Controller('me')
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly account: AccountService,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<ProfileView> {
    return this.profiles.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<ProfileView> {
    return this.profiles.update(user.id, dto);
  }

  /** First-run setup: name, favorite genres and preferences. */
  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  completeOnboarding(
    @CurrentUser() user: AuthUser,
    @Body() dto: CompleteOnboardingDto,
  ): Promise<ProfileView> {
    return this.profiles.update(user.id, dto, true);
  }

  @Get('username-availability')
  async usernameAvailability(@CurrentUser() user: AuthUser, @Query() query: UsernameQueryDto) {
    return {
      username: query.username,
      available: await this.profiles.isUsernameAvailable(user.id, query.username),
    };
  }

  /** Uploads a profile picture (PNG, JPEG or WebP, up to 2 MB). */
  @Put('avatar')
  @UseInterceptors(IMAGE_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @ApiBody(IMAGE_UPLOAD_BODY)
  setAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: UploadedImage,
  ): Promise<ProfileView> {
    return this.profiles.setAvatar(user.id, file);
  }

  @Delete('avatar')
  removeAvatar(@CurrentUser() user: AuthUser): Promise<ProfileView> {
    return this.profiles.removeAvatar(user.id);
  }

  /** Downloads all personal data as JSON. */
  @Get('export')
  @Header('Content-Disposition', 'attachment; filename="my-movie-catalog-export.json"')
  export(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.account.export(user.id);
  }

  /**
   * Permanently deletes the account and personal data. Requires a fresh code: call
   * `POST /auth/otp` with your own email, then send the code here.
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteAccountDto,
    @Client() client: ClientContext,
  ): Promise<void> {
    await this.account.delete(user, dto.code, client);
  }
}
