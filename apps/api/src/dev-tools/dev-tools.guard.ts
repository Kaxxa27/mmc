import { type CanActivate, Injectable } from '@nestjs/common';
import { notFound } from '../common/errors.js';
import { AppConfig } from '../config/app-config.js';

/** Developer endpoints do not exist unless DEV_TOOLS_ENABLED (never in production). */
@Injectable()
export class DevToolsGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(): boolean {
    if (!this.config.devTools.enabled) throw notFound('NOT_FOUND', 'Not found.');
    return true;
  }
}
