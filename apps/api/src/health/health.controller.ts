import { Controller, Get, Headers, HttpStatus, Res } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/auth.decorators.js';
import { unauthorized } from '../common/errors.js';
import { AppConfig } from '../config/app-config.js';
import { HealthService, type HealthReport } from './health.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthService,
    private readonly config: AppConfig,
  ) {}

  /** Liveness and dependency status. Returns 503 when the database is unreachable. */
  @Public()
  @Get()
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthReport> {
    const report = await this.health.check();
    if (report.status === 'down') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }

  /**
   * Keeps the Supabase Free project awake (it pauses after about a week without activity). Vercel
   * Cron calls it every 5 days. When `CRON_SECRET` is set, requires `Authorization: Bearer <it>`.
   */
  @Public()
  @Get('keep-alive')
  keepAlive(@Headers('authorization') authorization?: string) {
    const secret = this.config.cronSecret;
    if (secret && !safeEqual(authorization ?? '', `Bearer ${secret}`)) {
      throw unauthorized('CRON_UNAUTHORIZED', 'Missing or invalid cron secret.');
    }
    return this.health.keepAlive();
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
