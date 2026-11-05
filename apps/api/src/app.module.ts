import { type MiddlewareConsumer, Module, type NestModule, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CollectionsModule } from './collections/collections.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { RequestLoggerMiddleware } from './common/request-logger.middleware.js';
import { AppConfig } from './config/app-config.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DevToolsModule } from './dev-tools/dev-tools.module.js';
import { DiscoveryModule } from './discovery/discovery.module.js';
import { HealthModule } from './health/health.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { GroupAccessModule } from './groups/group-access.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { LibraryModule } from './library/library.module.js';
import { MediaModule } from './media/media.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { MailModule } from './mail/mail.module.js';
import { MovieNightsModule } from './movie-nights/movie-nights.module.js';
import { MoviesModule } from './movies/movies.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { RateLimitModule } from './rate-limit/rate-limit.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { TmdbModule } from './tmdb/tmdb.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    SupabaseModule,
    MailModule,
    AuditModule,
    RateLimitModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => [
        { name: 'default', ttl: 60_000, limit: config.http.rateLimitPerMinute },
      ],
    }),
    // Serverless functions (Vercel) do not stay alive between requests, so jobs are not scheduled there.
    ...(process.env.VERCEL ? [] : [ScheduleModule.forRoot()]),
    HealthModule,
    NotificationsModule,
    AuthModule,
    TmdbModule,
    MoviesModule,
    MediaModule,
    GroupAccessModule,
    ProfilesModule,
    LibraryModule,
    ReviewsModule,
    CollectionsModule,
    GroupsModule,
    MovieNightsModule,
    DiscoveryModule,
    JobsModule,
    DevToolsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*path');
  }
}
