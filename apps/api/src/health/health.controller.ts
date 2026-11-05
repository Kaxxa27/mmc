import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/auth.decorators.js';
import { HealthService, type HealthReport } from './health.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness and dependency status. Returns 503 when the database is unreachable. */
  @Public()
  @Get()
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthReport> {
    const report = await this.health.check();
    if (report.status === 'down') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}
