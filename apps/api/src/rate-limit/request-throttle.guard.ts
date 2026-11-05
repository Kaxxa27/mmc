import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { tooManyRequests } from '../common/errors.js';
import { AppConfig } from '../config/app-config.js';

const SKIP_THROTTLE = 'skipThrottle';
const WINDOW_MS = 60_000;

/** Excludes a controller or route from the general per-IP request limit. */
export const SkipThrottle = () => SetMetadata(SKIP_THROTTLE, true);

interface Bucket {
  hits: number;
  windowStartedAt: number;
}

/**
 * General per-IP request limit (`RATE_LIMIT_PER_MINUTE`), fixed one-minute window, kept in
 * memory per process. Sensitive endpoints additionally use the shared Postgres-backed
 * RateLimitService.
 */
@Injectable()
export class RequestThrottleGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweepAt = Date.now();

  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const skip = this.reflector.getAllAndOverride<boolean | undefined>(SKIP_THROTTLE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const now = Date.now();
    this.sweep(now);

    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    let bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStartedAt >= WINDOW_MS) {
      bucket = { hits: 0, windowStartedAt: now };
      this.buckets.set(key, bucket);
    }
    bucket.hits += 1;

    if (bucket.hits > this.config.http.rateLimitPerMinute) {
      const retryAfterSeconds = Math.ceil((bucket.windowStartedAt + WINDOW_MS - now) / 1000);
      throw tooManyRequests(
        'RATE_LIMITED',
        'Too many requests. Please slow down.',
        Math.max(1, retryAfterSeconds),
      );
    }
    return true;
  }

  /** Drops expired windows so the map does not grow without bound. */
  private sweep(now: number): void {
    if (now - this.lastSweepAt < WINDOW_MS) return;
    this.lastSweepAt = now;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStartedAt >= WINDOW_MS) this.buckets.delete(key);
    }
  }
}
