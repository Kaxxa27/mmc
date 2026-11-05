# My Movie Catalog

A personal and shared movie catalog: discover movies, keep watchlists and viewing history, rate and
review, build collections, share a catalog with family or friends and decide together what to
watch on movie night.

**Status:** the MVP is implemented: a NestJS API (unit and end-to-end tests against the local
stack) and a Next.js web app that covers the whole API.

## What is implemented

| Area (roadmap phase)        | Highlights                                                                                                                                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local environment (1)       | Supabase Local (Postgres, Auth, Storage, Studio), Mailpit inbox, one-command setup, data kept between restarts                                                                                                                                                    |
| Passwordless sign-in (2)    | 6-digit email codes and magic links, accounts created on first verification, rotating refresh tokens, sign out of one / other / all devices, session list, rate limits and attempt limits, onboarding, profile and avatar, data export, account deletion          |
| Movie catalog (3)           | TMDB discovery lists, search, advanced filters, details (cast, crew, trailers, age ratings, similar titles, where to watch), personal catalog with statuses, favorites, ratings, private notes, viewing history and rewatches, statistics, collections, reviews   |
| Family and groups (4)       | Groups with owner / admin / member roles, email and link invitations, shared catalog with each member's personal status, group ratings and reviews, comments with @mentions, archive and ownership transfer                                                       |
| Movie nights and social (5) | Movie Night Planner (criteria, shortlist, candidates, voting, random pick, history), in-app and email notifications with preferences, release reminders, calendar                                                                                                 |
| Recommendations (6, basic)  | Home page, "because you liked", favorite genres, popular in your groups, highly rated, hidden gems, continue exploring                                                                                                                                            |
| Web app                     | Next.js screens for every API feature: discovery, search, movie and person pages, catalog, history, stats, calendar, reviews, collections, groups, movie nights, notifications, settings; sign-in with codes and magic links; light and dark themes; phone layout |
| Developer experience        | Mock TMDB dataset (no key needed), Swagger UI with quick sign-in, local mailbox, demo family and automatic authorization                                                                                                                                          |

## Tech stack

| Concern        | Choice                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| API            | [NestJS 12](https://nestjs.com/) (ESM) on Node.js 22, TypeScript 6 (strict)                            |
| Web app        | [Next.js 16.4](https://nextjs.org/) (App Router, Cache Components), React 19, Tailwind CSS 4           |
| Web data / UI  | TanStack Query 5, Radix UI primitives, lucide icons, sonner toasts                                     |
| Code quality   | ESLint 10 + typescript-eslint (type-aware rules), Prettier 3                                           |
| Tests          | Vitest 5 (unit, API and web), Vitest + Supertest against the local stack (end-to-end)                  |
| Database       | PostgreSQL 17 via Supabase Local, [Drizzle ORM](https://orm.drizzle.team/) schema and migrations       |
| Authentication | Supabase Auth (email OTP / magic link); the API verifies access tokens with the project's public keys  |
| Email (local)  | [Mailpit](https://mailpit.axllent.org/) (sign-in codes from Supabase Auth, invitations from the API)   |
| File storage   | Supabase Storage (`media` bucket: avatars, group pictures, collection covers)                          |
| Movie data     | [TMDB API](https://developer.themoviedb.org/), cached in Postgres; built-in mock dataset without a key |
| API docs       | OpenAPI / Swagger UI generated from the code                                                           |

## Repository layout

```
.
├── apps/
│   ├── api/                  NestJS backend
│   │   ├── src/
│   │   │   ├── auth/         passwordless sign-in, sessions, auth guard
│   │   │   ├── profiles/     profile, onboarding, avatar, export, account deletion
│   │   │   ├── movies/       TMDB discovery, search, details, people, genres, offline catalog
│   │   │   ├── tmdb/         TMDB client, response cache and the mock TMDB dataset (tmdb/mock)
│   │   │   ├── dev-tools/    development-only helpers for Swagger (quick sign-in, mailbox, demo)
│   │   │   ├── library/      personal catalog, viewing history, statistics
│   │   │   ├── reviews/      personal and published reviews
│   │   │   ├── collections/  custom collections and sharing
│   │   │   ├── groups/       groups, members, invitations, shared catalog, comments
│   │   │   ├── movie-nights/ Movie Night Planner
│   │   │   ├── discovery/    home page, recommendations, calendar
│   │   │   ├── notifications/, jobs/, mail/, media/, audit/, rate-limit/, health/
│   │   │   └── database/     Drizzle schema (source of truth for the tables)
│   │   └── test/             end-to-end tests
│   └── web/                  Next.js web app
│       └── src/
│           ├── app/          routes: (app) pages with the app shell, (auth) sign-in screens,
│           │                 bff/[...path] (the API proxy that holds the session)
│           ├── features/     one folder per area (movie, library, groups, movie-nights, ...)
│           ├── components/   UI kit, layout, movie cards and dialogs, charts, calendar, comments
│           ├── lib/          API client and types, TanStack Query hooks, session helpers
│           └── proxy.ts      redirects signed-out visitors away from private pages
├── supabase/
│   ├── config.toml           local stack configuration (auth, email, storage)
│   ├── migrations/           SQL migrations (generated by drizzle-kit + custom SQL)
│   ├── seed.sql              offline sample movies
│   └── templates/            sign-in email templates
└── scripts/sync-env.mjs      writes apps/api/.env from the running local stack
```

## Getting started

### Prerequisites

- **Node.js 22** (`.nvmrc`; 22.22 or newer avoids an engine warning from the Nest CLI's code
  generators) and npm.
- **Docker**, for example [OrbStack](https://orbstack.dev/) or Docker Desktop, running.
- Optional: a free **TMDB API Read Access Token** (TMDB account → Settings → API). Without it the
  API uses a built-in mock of TMDB (see [Movie data](#movie-data-live-mock-or-offline)).

### First run

```bash
npm install            # installs the API, the web app and the Supabase CLI
npm run setup          # starts Supabase Local (first run downloads images) and writes apps/api/.env
npm run dev            # starts the API and the web app in watch mode
```

Then open:

| What                  | URL                            |
| --------------------- | ------------------------------ |
| Web app               | http://localhost:3000          |
| API                   | http://127.0.0.1:3001/api/v1   |
| API docs (Swagger UI) | http://127.0.0.1:3001/api/docs |
| Email inbox (Mailpit) | http://127.0.0.1:54324         |
| Database UI (Studio)  | http://127.0.0.1:54323         |

In the web app, the sign-in page has **development shortcuts**: sign in as Anna, Ben or Chloe
without a code, create the demo family (group, shared catalog, a movie night in the voting phase)
in one click, or fill in the code from Mailpit. They appear only while the API runs with developer
tools enabled.

Without a TMDB key the API answers movie requests from its built-in mock dataset. To use live movie
data, add `TMDB_API_READ_ACCESS_TOKEN=...` to `apps/api/.env` (or `.env.local`) and restart the
API. `npm run env:sync` never overwrites values you added yourself.

### Test the API in Swagger UI

Open http://127.0.0.1:3001/api/docs. Sections are collapsed; use the filter box to find endpoints,
"Try it out" is already enabled, and request bodies come with realistic examples.

1. **Sign in:** `POST /api/v1/dev/sign-in` with any address, e.g. `{ "email": "anna@example.com" }`.
   Swagger UI applies the returned token automatically, so every request after that is
   authenticated (the padlocks close).
2. **Get a whole family:** `POST /api/v1/dev/demo` creates Anna, Ben and Chloe with a shared
   catalog (different personal statuses, group ratings), a movie night in the voting phase and a
   shared Christmas collection, and returns a token for each of them. Swagger is authorized as
   Anna; paste another member's token into **Authorize** to act as them. Pass
   `{ "namespace": "smiths" }` to create a separate family.
3. **Explore:** `GET /api/v1/home`, `GET /api/v1/movies/search?query=toy`,
   `GET /api/v1/movies/27205`, `PUT /api/v1/me/movies/862`, `GET /api/v1/me/recommendations`,
   `PUT /api/v1/movie-nights/{id}/vote`...

To test the real passwordless flow, call `POST /api/v1/auth/otp`, read the code with
`GET /api/v1/dev/mailbox?email=...` (or in Mailpit), then `POST /api/v1/auth/otp/verify`. The
mailbox also shows magic-link tokens and invitation tokens (for
`POST /api/v1/invitations/{token}/accept`).

The developer endpoints exist only in development (`DEV_TOOLS_ENABLED`, on by default when
`NODE_ENV=development`) and cannot be enabled in production. The raw OpenAPI document is at
http://127.0.0.1:3001/api/docs/openapi.json for Postman or Insomnia.

### Stopping and restarting

`npm run supabase:stop` stops the containers and keeps the data; `npm run supabase:start` brings it
back. Data survives computer restarts. `npm run db:reset` **wipes the local database** and reloads
the migrations and sample movies.

## Web app

The web app (`apps/web`) talks to the API through its own backend-for-frontend route, so tokens
never reach browser JavaScript:

```
browser ──/bff/api/v1/*──▶ Next.js route handler ──Bearer token──▶ NestJS API
            (cookies)        refreshes tokens, strips them from responses
```

- **Session.** Sign-in responses (`auth/otp/verify`, `auth/magic-link/verify`, and the dev
  shortcuts) are turned into httpOnly cookies (`mmc_at` access token, `mmc_rt` refresh token,
  30 days) and the tokens are removed from the JSON the browser sees. The route refreshes the
  access token shortly before it expires, retries once if the API reports an expired token and
  clears the cookies when the session was revoked. A readable `mmc_signed_in=1` cookie only tells
  the browser that a session exists, so guests do not request `/me`.
- **Protection.** Requests that change data must come from the same origin (`Sec-Fetch-Site` /
  `Origin` check) on top of `SameSite=Lax` cookies. Only `/api/v1/*` is forwarded.
- **Private pages.** `proxy.ts` sends signed-out visitors from private pages to
  `/sign-in?next=...`; the API still enforces every permission. Public collections open for
  anyone with the link.
- **Data.** Screens fetch on the client with TanStack Query; mutations refresh every view that
  shows the changed data (statuses on cards, lists, group catalogs...). Filters live in the URL, so
  searches and lists can be shared and survive reloads.
- **Rendering.** Next.js 16 Cache Components are on: the app frame is prerendered and every part
  that reads queries or the URL sits in a `<Suspense>` boundary, as the framework requires.
- **Configuration.** `API_URL` (default `http://127.0.0.1:3001`) points the route handler at the
  API; see `apps/web/.env.example`. Movie data follows the language and country from the profile.

| Area       | Pages                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Discover   | `/` home, `/discover` lists and filters, `/search`, `/movies/{id}`, `/people/{id}`                                                                     |
| My catalog | `/my-movies`, `/watchlist` (random pick), `/history`, `/reviews`, `/stats`, `/calendar`                                                                |
| Together   | `/collections`, `/groups/{id}` (catalog, movie nights, members, collections, calendar, settings), `/groups/{id}/movies/{tmdbId}`, `/movie-nights/{id}` |
| Account    | `/sign-in`, `/auth/confirm` (magic links), `/onboarding`, `/invitations/{token}`, `/notifications`, `/settings`                                        |

## Everyday commands

Run from the repository root:

| Command                                   | What it does                                                 |
| ----------------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                             | API and web app in watch mode (`dev:api`, `dev:web` run one) |
| `npm run build`                           | Production builds (`apps/api/dist`, `apps/web/.next`)        |
| `npm run lint`                            | ESLint (type-aware)                                          |
| `npm run format` / `npm run format:check` | Prettier                                                     |
| `npm run typecheck`                       | TypeScript without emitting                                  |
| `npm test`                                | Unit tests                                                   |
| `npm run test:e2e`                        | End-to-end tests (local stack must be running)               |
| `npm run check`                           | Formatting, lint, types and unit tests in one go             |
| `npm run supabase:status`                 | URLs and keys of the local stack                             |
| `npm run env:sync`                        | Regenerate the Supabase values in `apps/api/.env`            |

## Database and migrations

The Drizzle schema in `apps/api/src/database/schema` is the source of truth for the tables. To
change the database:

```bash
# 1. edit the schema, then generate a migration into supabase/migrations
npm run db:generate --workspace @my-movie-catalog/api -- --name describe_the_change
# 2. apply it to the local database without losing data
npx supabase migration up
```

SQL that Drizzle cannot express (triggers, extensions, privileges) goes into a custom migration:
`npm run db:generate --workspace @my-movie-catalog/api -- --custom --name ...`.

Every table has row level security enabled and the public Supabase roles have no privileges, so
the Supabase Data API cannot read or change application data. All access goes through the NestJS
API, which connects as the database owner. Declare every new table with `.enableRLS()`; a unit
test fails if one is missing.

## Testing

- **Unit tests** (`npm test`): voting and shortlist logic, filters, presenters, configuration,
  TMDB client, the mock TMDB dataset, Swagger auto-authorization, preferences and helpers. In the
  web app: the BFF route (cookies, token stripping, refresh, revoked sessions, cross-site
  rejection, sign-out scopes), session helpers, the API client, notification links and helpers.
- **Browser smoke tests** (`npm run test:ui --workspace @my-movie-catalog/web`, Playwright with
  the installed Google Chrome): guest browsing and the redirect to sign-in, then the demo family
  flow (group, movie night vote, status changes, main pages, sign-out). The local stack must be
  running; `npm run dev` is started automatically if the web app is not up.
- **End-to-end tests** (`npm run test:e2e`) run the whole application against the local Supabase
  stack and read real emails from Mailpit. They cover the acceptance scenarios from the product
  plan: sign-up and sign-in with codes and magic links, rejected invalid / expired / reused codes,
  rate limits, sign-out on one or all devices, catalog management and privacy, group invitations
  and permissions, independent personal statuses, movie nights with voting and random picks,
  collections, reviews, calendar and reminders. One file runs against the mock TMDB dataset and one
  covers the developer tools. Each test file deletes the users it created.

## API overview

All routes live under `/api/v1`. Authenticate with `Authorization: Bearer <accessToken>`.
Discovery endpoints also work for guests. Errors always look like
`{ "statusCode": 404, "error": "Not Found", "code": "GROUP_NOT_FOUND", "message": "..." }`;
lists are paginated with `page` and `pageSize` and return `{ items, page, pageSize, total, totalPages }`.

| Area           | Main endpoints                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth           | `POST auth/otp`, `auth/otp/verify`, `auth/magic-link/verify`, `auth/refresh`, `auth/sign-out`, `GET auth/sessions`                                                     |
| Profile        | `GET/PATCH me`, `POST me/onboarding`, `PUT me/avatar`, `GET me/export`, `DELETE me`                                                                                    |
| Discovery      | `GET home`, `movies/lists/{popular,trending,top-rated,upcoming,now-playing}`, `movies/search`, `movies/discover`, `movies/{tmdbId}`, `people/{id}`, `search`, `genres` |
| My catalog     | `GET me/movies`, `PUT/DELETE me/movies/{tmdbId}`, `GET me/movies/random`, `GET me/lists`, `me/history`, `GET me/stats`, `GET me/recommendations`, `GET me/calendar`    |
| Reviews        | `PUT/DELETE me/reviews/{tmdbId}`, `GET movies/{tmdbId}/reviews`                                                                                                        |
| Collections    | `collections`, `collections/{id}/items`, `collections/{id}/shares`, `public/collections/{id}`                                                                          |
| Groups         | `groups`, `groups/{id}/members`, `groups/{id}/invitations`, `groups/{id}/invitation-links`, `invitations/{token}/accept`, `me/invitations`                             |
| Shared catalog | `groups/{id}/movies`, `groups/{id}/movies/{tmdbId}/rating`, `groups/{id}/movies/{tmdbId}/comments`, `groups/{id}/calendar`                                             |
| Movie nights   | `groups/{id}/movie-nights`, `movie-nights/{id}/suggestions`, `/candidates`, `/voting/start`, `/vote`, `/voting/close`, `/pick-random`, `/complete`, `/log-viewing`     |
| Notifications  | `me/notifications`, `me/notification-preferences`                                                                                                                      |
| Dev tools      | `POST dev/sign-in`, `GET dev/mailbox`, `POST dev/demo` (development only)                                                                                              |

Swagger UI documents every endpoint, parameter and validation rule.

## Security and privacy

- No passwords anywhere: sign-in uses single-use 6-digit codes or magic links that expire after
  10 minutes. Responses never reveal whether an address is registered.
- Abuse protection: 60 s between codes, per-address and per-IP hourly limits, 5 wrong codes per
  issued code, per-IP verification limit (stored in Postgres, so it survives restarts).
- Sessions: 1-hour access tokens verified locally against the Supabase JWKS, rotating refresh
  tokens, revoked sessions are rejected immediately, 30-day lifetime and 14-day inactivity limit.
- Private data stays private: catalog entries, ratings, notes and private reviews are only ever
  returned to their owner; non-members get "not found" for groups; other users are shown by name,
  never by email.
- Invitation tokens are stored only as SHA-256 hashes; email invitations can only be accepted with
  the invited address.
- Uploads are checked by content (PNG, JPEG, WebP; max 2 MB), not by the declared type.
- Account deletion requires a fresh email code, hands owned groups to another member and removes
  all personal data in one transaction. `GET /me/export` downloads everything as JSON.
- Important actions (sign-ins, deletions, role and ownership changes) are written to
  `audit_events`.
- Secrets (TMDB, Supabase service key, SMTP) live only in the API environment; `.env` files are
  git-ignored.
- The web app keeps tokens in httpOnly cookies behind its BFF route and rejects cross-site
  writes; see [Web app](#web-app).

## Movie data: live, mock or offline

`TMDB_MODE` (default `auto`) chooses the source:

| Mode      | When (`auto`)                     | What you get                                                                                           |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `live`    | a TMDB key is set                 | Real TMDB data, cached in Postgres (lists 1 h, search 15 min, details 12 h)                            |
| `mock`    | no key and `NODE_ENV=development` | A built-in dataset that answers the same TMDB endpoints with TMDB-shaped responses, without network    |
| `offline` | no key in tests and production    | Only the local catalog (bundled sample movies and movies saved before); no cast, trailers or providers |

The **mock dataset** (`apps/api/src/tmdb/mock`) exercises the same code path as live TMDB: the
client, the cache, the presenters, discover filters, people pages and recommendations. It contains:

- the 46 sample movies with their real TMDB ids, main cast and crew, age ratings for US / GB / DE /
  RU, alternative and Russian titles (try `?query=унесённые` or `?language=ru-RU`);
- 10 fictional movies whose release dates are relative to today, so "upcoming", "now playing" and
  the release reminders always have content (ids 900000001-900000010, marked as fictional);
- generated SVG posters, backdrops, profile pictures and provider logos, served by the API;
- invented streaming availability (labelled as mock data) and placeholder trailer entries whose
  YouTube keys do not exist.

`TMDB_MOCK_LATENCY_MS` adds an artificial delay to see loading states in the web app. When you
switch to a real key, mock cache entries are ignored and movies saved while using the mock are
refreshed from TMDB in the background after the next start.

With live TMDB, if TMDB is down, the last cached data is served, then the local catalog. A movie
is stored in the shared `movies` table the first time someone saves or opens it, so all users and
groups reference the same row. Streaming availability ("where to watch") then comes from
JustWatch via TMDB and is shown per region with the time it was checked.

## Design decisions worth knowing

- **ESLint instead of oxlint.** The Nest 12 template now ships oxlint; ESLint with typescript-eslint
  was chosen for its type-aware rules (floating promises, unsafe `any`). It supports TypeScript up
  to 6.0, so TypeScript is pinned to `~6.0`.
- **Supabase CLI 2.x.** CLI 3.0 was released days before this project started; the mature 2.x line
  (`v2.stable`) is used until 3.x settles.
- **Email confirmation on.** The first successful code or link verification confirms the address;
  Supabase therefore creates no session before that. Accounts that never confirm are removed
  after 7 days.
- **Favorite is a flag, not a status.** A movie can be both "watched" and a favorite. Statuses
  are want to watch, watching, watched and not interested; "not interested" hides the movie from
  lists and recommendations.
- **Group ratings are separate from personal ratings.** Members share a rating with a group
  explicitly; personal ratings and notes stay private. Personal viewing statuses of movies in a
  group's catalog are visible to that group's members (so the family can see who watched what).
- **One vote per participant** in movie nights; votes are anonymous until the movie is decided.

## Not built yet

- Translations of the interface (it is in English; movie data follows the profile language) and
  broader browser test coverage (only smoke tests so far).
- Administration area and content reporting / moderation.
- Changing the email address, passkeys, re-authentication for more sensitive actions.
- Real-time updates (live voting), push notifications, richer group activity feed.
- Deployment automation. Deploying by hand to Vercel + Supabase Cloud (free plans) is described
  step by step in [docs/deploy-vercel.md](docs/deploy-vercel.md). In production, keep the
  Supabase keys on the server (clients only talk to the API, so Supabase Auth's own sign-up
  endpoints stay unused), set `TRUST_PROXY=true` behind a proxy and review TMDB's commercial terms
  before monetisation.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability
data is provided by JustWatch through TMDB.
