# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

My Movie Catalog: an npm-workspaces monorepo with a NestJS 12 API (`apps/api`) and a Next.js 16.4
web app (`apps/web`), backed by Supabase (Postgres, Auth, Storage) and TMDB. GitHub repo:
`Kaxxa27/mmc`. The README has diagrams of the architecture, the sign-in flow and the database.

## Commands

From the repository root (Node 22, Docker running for Supabase Local):

```bash
npm run setup          # start Supabase Local + write apps/api/.env (npm run env:sync regenerates it)
npm run dev            # API on 127.0.0.1:3001 + web on localhost:3000 (dev:api / dev:web for one)
npm run check          # prettier --check, eslint, typecheck, unit tests (run before a PR)
npm run test:e2e       # API end-to-end tests; Supabase Local must be running
npm run db:reset       # wipes the local DB, reapplies migrations + supabase/seed.sql
```

Single tests (Vitest):

```bash
cd apps/api && npx vitest run src/movie-nights/movie-night.logic.spec.ts -t "random"   # API unit: src/**/*.spec.ts
cd apps/api && npx vitest run --config vitest.config.e2e.ts test/groups.e2e-spec.ts    # API e2e: test/**/*.e2e-spec.ts
cd apps/web && npx vitest run src/lib/__tests__/session.test.ts                        # web unit: src/**/*.test.ts
cd apps/web && npm run test:ui                                                          # Playwright smoke (e2e/)
```

Schema changes: edit `apps/api/src/database/schema`, then
`npm run db:generate --workspace @my-movie-catalog/api -- --name <change>` (writes SQL into
`supabase/migrations`) and `npx supabase migration up`. Use `-- --custom --name ...` for triggers,
extensions and grants. Never run `supabase config push`: `supabase/config.toml` holds local-only
settings that would overwrite the cloud project.

## Architecture

**Request path.** Browser → Next.js BFF route `apps/web/src/app/bff/[...path]/route.ts` → NestJS
`/api/v1/*` → Postgres / Supabase Auth / Storage / TMDB / SMTP. The web app never calls Supabase,
and tokens never reach browser JS. The BFF stores sessions in httpOnly cookies (`mmc_at`, `mmc_rt`),
refreshes them, rejects cross-site writes and strips tokens from responses. Any new API endpoint
that returns a session must be added to `SESSION_ENDPOINTS` in that route, or sign-in will not
stick.

**API conventions (apps/api/src):**

- ESM (`"type": "module"`): relative imports end in `.js`. Nest 12 packages are ESM-only. Do not add
  CommonJS libraries that `require()` `@nestjs/*`: they work locally (Node 22 allows require(esm))
  but crash on Vercel with `ERR_REQUIRE_ESM`, which is why `@nestjs/throttler` was replaced by
  `rate-limit/request-throttle.guard.ts`. Reproduce with `node --no-experimental-require-module`.
- `AuthGuard` is global: routes require a signed-in user unless marked `@Public()` or
  `@OptionalAuth()` (`auth/auth.decorators.ts`).
- Errors: throw the helpers from `common/errors.ts` (`notFound('GROUP_NOT_FOUND', '...')`, etc.).
  `AllExceptionsFilter` turns them into `{ statusCode, error, code, message, details? }`. Clients
  switch on `code`.
- Config: every env var is declared in `config/env.schema.ts` (zod) and exposed through `AppConfig`
  (`config/app-config.ts`), which is injectable everywhere. Never read `process.env` in features.
  `DEV_TOOLS_ENABLED` is rejected in production. `DEMO_ACCOUNTS_ENABLED` and `CRON_SECRET` are
  production-safe.
- DTOs: the global `ValidationPipe` uses `whitelist` + `forbidNonWhitelisted`. The Swagger CLI
  plugin (`nest-cli.json`) introspects `*.dto.ts` / `*.controller.ts`, so JSDoc comments and
  `@example` tags become the OpenAPI docs.
- Database: Drizzle schema in `database/schema` is the source of truth. Every table needs
  `.enableRLS()` (enforced by `schema.spec.ts`). RLS has no policies: only the API, connecting as
  the owner, can read data.
- Rate limits that must hold across instances use `RateLimitService` (Postgres fixed windows).
  The in-memory guard is only the coarse per-IP limit. Behind the BFF all users share the web
  server's IPs, so per-IP keys are effectively global.
- TMDB: `tmdb/tmdb.client.ts` + `tmdb-cache.service.ts` (cache in Postgres). `TMDB_MODE` is `live`,
  `mock` (built-in dataset in `tmdb/mock`, the dev default without a key) or `offline` (local
  `movies` table only; used by e2e tests and keyless production). Movies are upserted into the
  shared `movies` table and referenced by uuid. Image URLs are built from `TMDB_IMAGE_BASE_URL`.
- `dev-tools/`: `/dev/*` (quick sign-in with any email, Mailpit reader, demo family) exists only
  with dev tools enabled. `/demo/sign-in` signs in only to the three shared demo accounts
  (`auth/demo-accounts.ts`). Those accounts get special privacy handling: no sign-in
  notifications, hidden session IPs, no email invites, no mail sent to them.

**Web conventions (apps/web/src):** `lib/api/types.ts` is a hand-written mirror of API response
shapes: update it when an API response changes. Next.js Cache Components are on, so components
that read queries, cookies or the URL must sit inside `<Suspense>`. `proxy.ts` (Next 16's
middleware) redirects signed-out users from private routes.

**Two entry points for the API.** `main.ts` runs a normal server. `serverless.ts` is the Vercel
handler: `apps/api/api/index.js` re-exports `dist/serverless.js`, and `vercel.json` rewrites all
paths to it. Both share `app.setup.ts`. On Vercel (`process.env.VERCEL`) `ScheduleModule` is
skipped, so the jobs in `jobs/` don't run. Instead `vercel.json` `crons` calls
`/api/v1/health/keep-alive` every 5 days so Supabase Free does not pause. The build also copies
Swagger UI assets into `public/api/docs`. Deployment steps are in `docs/deploy-vercel.md`.

## Gotchas

- `apps/*/.env.production.example` files are gitignored on purpose: the local copies hold real
  production secrets. Never stage or commit them. Stage files explicitly instead of `git add -A`.
- The API e2e tests share one database and run sequentially. `test/utils/test-app.ts` boots the
  real `AppModule` in-process and deletes the users it created. `test/setup-env.ts` forces
  `TMDB_MODE=offline` and disables dev tools and jobs.
