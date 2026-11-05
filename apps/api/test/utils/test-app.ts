import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { AppConfig } from '../../src/config/app-config.js';
import { extractCode, waitForEmail } from './mailpit.js';

export interface TestUser {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  /** `Authorization` header for supertest's `.set()`. */
  auth: { Authorization: string };
}

/** The real application (all modules, guards, pipes) running in-process for supertest. */
export class TestApp {
  private readonly createdUserIds = new Set<string>();
  private readonly generatedEmails = new Set<string>();

  private constructor(
    readonly app: INestApplication,
    readonly config: AppConfig,
    /** Direct database access for assertions and test setup. */
    readonly db: Pool,
  ) {}

  static async create(): Promise<TestApp> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: ['error', 'warn'],
    });
    const config = app.get(AppConfig);
    configureApp(app, config);
    await app.init();
    return new TestApp(app, config, new Pool({ connectionString: config.database.url, max: 2 }));
  }

  http(): TestAgent {
    return request(this.app.getHttpServer());
  }

  /** Unique address on a domain Mailpit captures. */
  uniqueEmail(prefix: string): string {
    const email = `${prefix}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}@example.com`;
    this.generatedEmails.add(email);
    return email;
  }

  /** Full passwordless sign-in through the API: request code, read it from Mailpit, verify. */
  async signIn(email: string = this.uniqueEmail('user')): Promise<TestUser> {
    const since = new Date();
    await this.http().post('/api/v1/auth/otp').send({ email }).expect(202);
    const code = extractCode(await waitForEmail(email, { since }));
    const response = await this.http()
      .post('/api/v1/auth/otp/verify')
      .send({ email, code })
      .expect(200);
    const body = response.body as {
      accessToken: string;
      refreshToken: string;
      user: { id: string };
    };
    this.createdUserIds.add(body.user.id);
    return {
      id: body.user.id,
      email,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      auth: { Authorization: `Bearer ${body.accessToken}` },
    };
  }

  /** Signs in and completes onboarding so the user has a display name. */
  async signInWithProfile(firstName: string): Promise<TestUser> {
    const user = await this.signIn(this.uniqueEmail(firstName.toLowerCase()));
    await this.http()
      .post('/api/v1/me/onboarding')
      .set(user.auth)
      .send({ firstName, favoriteGenreIds: [35, 16] })
      .expect(200);
    return user;
  }

  trackUser(id: string): void {
    this.createdUserIds.add(id);
  }

  /** Deletes every user created by this test file (and the groups they own). */
  async close(): Promise<void> {
    // Addresses that requested a code but never verified it still have an (unconfirmed) account.
    const unverified = await this.db.query<{ id: string }>(
      'select id from auth.users where email = any($1::text[])',
      [[...this.generatedEmails]],
    );
    for (const row of unverified.rows) this.createdUserIds.add(row.id);
    const ids = [...this.createdUserIds];
    if (ids.length > 0) {
      await this.db.query('delete from groups where owner_id = any($1::uuid[])', [ids]);
      const admin = createClient(this.config.supabase.url, this.config.supabase.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      for (const id of ids) {
        await admin.auth.admin.deleteUser(id);
      }
    }
    await this.db.end();
    await this.app.close();
  }
}
