import {
  Body,
  type CanActivate,
  Controller,
  HttpCode,
  HttpStatus,
  Injectable,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Client, Public } from '../auth/auth.decorators.js';
import type { ClientContext } from '../auth/auth.types.js';
import { AuthSessionDto } from '../auth/dto/auth.dto.js';
import { notFound } from '../common/errors.js';
import { AppConfig } from '../config/app-config.js';
import { DevToolsService } from './dev-tools.service.js';
import { DemoSignInDto } from './dto/dev-tools.dto.js';

/** Demo endpoints do not exist unless DEMO_ACCOUNTS_ENABLED. */
@Injectable()
export class DemoAccountsGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(): boolean {
    if (!this.config.demoAccounts.enabled) throw notFound('NOT_FOUND', 'Not found.');
    return true;
  }
}

/**
 * Shared demo accounts for test deployments (`DEMO_ACCOUNTS_ENABLED`). Unlike the developer
 * tools, only the fixed demo users can be signed in to, so this is safe to enable in production.
 */
@ApiTags('Demo accounts')
@Public()
@UseGuards(DemoAccountsGuard)
@Controller('demo')
export class DemoAccountsController {
  constructor(private readonly devTools: DevToolsService) {}

  /**
   * Signs in as a shared demo user (Anna, Ben or Chloe) without an email code. The demo family
   * (shared catalog, movie night, collection) is created on first use. Everyone shares these
   * accounts, so do not store anything private in them.
   */
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  signIn(@Body() dto: DemoSignInDto, @Client() client: ClientContext): Promise<AuthSessionDto> {
    return this.devTools.demoSignIn(dto.member, client);
  }
}
