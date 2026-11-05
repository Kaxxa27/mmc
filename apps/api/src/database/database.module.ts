import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppConfig } from '../config/app-config.js';
import { DRIZZLE, PG_POOL } from './database.constants.js';
import * as schema from './schema/index.js';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        const pool = new Pool({
          connectionString: config.database.url,
          max: config.database.poolMax,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          application_name: 'my-movie-catalog-api',
        });
        pool.on('error', (error) =>
          new Logger('Database').error(`Idle client error: ${error.message}`),
        );
        return pool;
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => drizzle(pool, { schema }),
    },
  ],
  exports: [DRIZZLE, PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
