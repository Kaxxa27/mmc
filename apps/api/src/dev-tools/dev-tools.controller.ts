import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Client, Public } from '../auth/auth.decorators.js';
import type { ClientContext } from '../auth/auth.types.js';
import { AuthSessionDto } from '../auth/dto/auth.dto.js';
import { DevToolsGuard } from './dev-tools.guard.js';
import { DevToolsService } from './dev-tools.service.js';
import {
  DemoRequestDto,
  DemoWorldDto,
  DevSignInDto,
  MailboxDto,
  MailboxQueryDto,
} from './dto/dev-tools.dto.js';

/** Development-only helpers for trying the API from Swagger UI. Disabled in production. */
@ApiTags('Dev tools')
@Public()
@UseGuards(DevToolsGuard)
@Controller('dev')
export class DevToolsController {
  constructor(private readonly devTools: DevToolsService) {}

  /**
   * Quick sign-in without an email: creates the account if needed and returns a normal session.
   * Swagger UI applies the access token automatically.
   */
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  signIn(@Body() dto: DevSignInDto, @Client() client: ClientContext): Promise<AuthSessionDto> {
    return this.devTools.signIn(dto.email, client);
  }

  /**
   * Latest emails sent to an address (read from Mailpit) with the sign-in code, magic-link token
   * and invitation token extracted, so the real passwordless flow can be tested in Swagger UI.
   */
  @Get('mailbox')
  mailbox(@Query() query: MailboxQueryDto): Promise<MailboxDto> {
    return this.devTools.mailbox(query.email, query.limit);
  }

  /**
   * Creates (once) a demo family: Anna, Ben and Chloe, a shared catalog, a movie night in the
   * voting phase and a shared collection. Returns an access token per member; Swagger UI is
   * authorized as Anna. Use "Authorize" to switch to another member.
   */
  @Post('demo')
  @HttpCode(HttpStatus.OK)
  demo(@Body() dto: DemoRequestDto, @Client() client: ClientContext): Promise<DemoWorldDto> {
    return this.devTools.createDemo(client, dto.namespace);
  }
}
