import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Client, CurrentUser, Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import type { AuthUser, ClientContext } from './auth.types.js';
import {
  ActiveSessionDto,
  AuthSessionDto,
  OtpRequestResponseDto,
  RefreshSessionDto,
  RequestOtpDto,
  SignOutDto,
  VerifyMagicLinkDto,
  VerifyOtpDto,
} from './dto/auth.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Emails a 6-digit sign-in code and a magic link. Unknown addresses get an account
   * automatically; the response never reveals whether the address was already registered.
   */
  @Public()
  @Post('otp')
  @HttpCode(HttpStatus.ACCEPTED)
  requestCode(
    @Body() dto: RequestOtpDto,
    @Client() client: ClientContext,
  ): Promise<OtpRequestResponseDto> {
    return this.auth.requestCode(dto.email, client);
  }

  /** Exchanges the emailed code for a session. Codes are single-use and expire. */
  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyCode(@Body() dto: VerifyOtpDto, @Client() client: ClientContext): Promise<AuthSessionDto> {
    return this.auth.verifyCode(dto.email, dto.code, client);
  }

  /** Exchanges the `token_hash` from a magic link for a session. */
  @Public()
  @Post('magic-link/verify')
  @HttpCode(HttpStatus.OK)
  verifyMagicLink(
    @Body() dto: VerifyMagicLinkDto,
    @Client() client: ClientContext,
  ): Promise<AuthSessionDto> {
    return this.auth.verifyMagicLink(dto.tokenHash, client);
  }

  /** Returns a new access token (refresh tokens rotate: use the new one next time). */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body() dto: RefreshSessionDto,
    @Client() client: ClientContext,
  ): Promise<AuthSessionDto> {
    return this.auth.refresh(dto.refreshToken, client);
  }

  /** Signs out this device (default), all other devices, or everywhere. */
  @ApiBearerAuth()
  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(
    @CurrentUser() user: AuthUser,
    @Body() dto: SignOutDto,
    @Client() client: ClientContext,
  ): Promise<void> {
    await this.auth.signOut(user, dto.scope ?? 'local', client);
  }

  /** Devices where the account is currently signed in. */
  @ApiBearerAuth()
  @Get('sessions')
  listSessions(@CurrentUser() user: AuthUser): Promise<ActiveSessionDto[]> {
    return this.auth.listSessions(user);
  }

  /** Signs out one specific device. */
  @ApiBearerAuth()
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Client() client: ClientContext,
  ): Promise<void> {
    await this.auth.revokeSession(user, sessionId, client);
  }
}
