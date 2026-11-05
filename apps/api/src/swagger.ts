import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ApiErrorResponseDto } from './common/dto/api-error.dto.js';
import type { AppConfig } from './config/app-config.js';

const TAGS: [name: string, description: string][] = [
  ['Dev tools', 'Development only: quick sign-in, the local mailbox and a ready-made demo family.'],
  ['Auth', 'Passwordless sign-in with 6-digit email codes or magic links, sessions and sign-out.'],
  ['Profile & account', 'Your profile, onboarding, avatar, data export and account deletion.'],
  ['Home & discovery', 'Home page, personalised recommendations and the calendar.'],
  ['Movies', 'Global movie database: lists, search, advanced filters and movie details.'],
  ['People', 'Actors, directors and other crew with their filmographies.'],
  ['Catalog metadata', 'Genres, client configuration and the combined search box.'],
  [
    'My catalog',
    'Your movies: statuses, favorites, ratings, private notes, history and statistics.',
  ],
  ['Reviews', 'Personal reviews (private by default) and published reviews.'],
  ['Collections', 'Custom collections: private, shared with people or groups, or public.'],
  ['Groups', 'Family and friends spaces, members and roles.'],
  ['Group invitations', 'Email and link invitations.'],
  ['Group catalog', "The group's shared catalog, group ratings and discussions."],
  ['Movie nights', 'Movie Night Planner: shortlist, candidates, voting and random picks.'],
  ['Notifications', 'In-app notifications and email / in-app preferences.'],
  ['Health', 'Service status.'],
];

function guide(config: AppConfig): string {
  const movieData = {
    mock:
      '**Movie data: mock.** No TMDB key is configured, so TMDB requests are answered by a built-in ' +
      'dataset shaped exactly like TMDB (56 movies including 10 fictional upcoming / now-playing ' +
      'titles, cast and crew, generated posters, Russian translations). Add ' +
      '`TMDB_API_READ_ACCESS_TOKEN` to `apps/api/.env` to switch to live TMDB.',
    live: '**Movie data: live TMDB.**',
    offline: '**Movie data: offline.** Only the bundled sample movies are available.',
  }[config.tmdb.mode];

  const signIn = config.devTools.enabled
    ? [
        '1. **Sign in.** Call `POST /api/v1/dev/sign-in` with any address, e.g. ' +
          '`{ "email": "anna@example.com" }`. Swagger UI applies the token automatically ' +
          '(the padlocks close). To test the real flow instead: `POST /api/v1/auth/otp` → ' +
          '`GET /api/v1/dev/mailbox?email=...` shows the code → `POST /api/v1/auth/otp/verify`.',
        '2. **Get a whole family.** `POST /api/v1/dev/demo` creates Anna, Ben and Chloe with a shared ' +
          'catalog, a movie night in the voting phase and a shared collection, and returns a token per ' +
          'member (Swagger is authorized as Anna). Switch members with **Authorize**.',
      ]
    : [
        '1. **Sign in.** `POST /api/v1/auth/otp` with your email, read the 6-digit code in the inbox ' +
          '(Mailpit locally), then `POST /api/v1/auth/otp/verify`. Swagger UI applies the token ' +
          'automatically.',
        '2. Invite a second account to a group to test the collaborative features.',
      ];

  return [
    'REST API of **My Movie Catalog**: passwordless sign-in, movie discovery, personal catalogs, ' +
      'collections, family groups and movie nights.',
    '',
    movieData,
    '',
    '### Try it in three steps',
    ...signIn,
    '3. **Explore.** `GET /api/v1/home`, `GET /api/v1/movies/search?query=toy`, ' +
      '`PUT /api/v1/me/movies/862`, `GET /api/v1/me/recommendations`, `GET /api/v1/groups`.',
    '',
    '### Handy movie ids (TMDB ids)',
    '862 Toy Story · 354912 Coco · 14160 Up · 129 Spirited Away · 27205 Inception · 10719 Elf · ' +
      '771 Home Alone · 508965 Klaus' +
      (config.tmdb.mock
        ? ' · 900000002 Galaxy Paws (upcoming, fictional) · 900000007 Paper Kites (now playing, fictional)'
        : ''),
    '',
    '### Conventions',
    '- Routes live under `/api/v1`. Protected routes need `Authorization: Bearer <accessToken>`.',
    '- Errors: `{ statusCode, error, code, message, details? }`; `code` is stable (e.g. `GROUP_NOT_FOUND`).',
    '- Lists: `page` and `pageSize` → `{ items, page, pageSize, total, totalPages }`.',
    '- The OpenAPI document is at `/api/docs/openapi.json` (import it into Postman or Insomnia).',
    ...(config.isProduction
      ? []
      : [
          '- Local tools: Mailpit http://127.0.0.1:54324 · Supabase Studio http://127.0.0.1:54323.',
        ]),
    '',
    'This product uses the TMDB API but is not endorsed or certified by TMDB.',
  ].join('\n');
}

/**
 * Runs inside Swagger UI (the function is serialized into the page): after a successful sign-in,
 * refresh or demo request, the returned access token is applied to "Authorize" automatically.
 * It must stay self-contained (no references to anything outside its body).
 */
export function swaggerAutoAuthorize(response: {
  url?: string;
  status?: number;
  body?: unknown;
  text?: string;
}) {
  try {
    const path = String(response.url ?? '').split('?')[0] ?? '';
    if (
      response.status === 200 &&
      /\/api\/v1\/(auth\/(otp\/verify|magic-link\/verify|refresh)|dev\/(sign-in|demo))$/.test(path)
    ) {
      const body = (
        typeof response.body === 'object' && response.body !== null
          ? response.body
          : JSON.parse(String(response.text ?? '{}'))
      ) as { accessToken?: unknown; users?: { accessToken?: unknown }[] };
      const token = body.accessToken ?? body.users?.[0]?.accessToken;
      const ui = (
        globalThis as unknown as { ui?: { authActions?: { authorize: (auth: unknown) => void } } }
      ).ui;
      if (typeof token === 'string' && ui?.authActions) {
        ui.authActions.authorize({
          bearer: {
            name: 'bearer',
            schema: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            value: token,
          },
        });
      }
    }
  } catch {
    // Never interfere with how Swagger UI shows the response.
  }
  return response;
}

export function buildOpenApiDocument(
  app: NestExpressApplication,
  config: AppConfig,
): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('My Movie Catalog API')
    .setDescription(guide(config))
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'The `accessToken` from a sign-in response.',
      },
      'bearer',
    )
    .addGlobalResponse(
      {
        status: 400,
        description: 'Invalid request (see `details` for validation messages)',
        type: ApiErrorResponseDto,
      },
      {
        status: 401,
        description: 'Missing, invalid or expired access token (protected routes)',
        type: ApiErrorResponseDto,
      },
      {
        status: 429,
        description: 'Too many requests (see the Retry-After header)',
        type: ApiErrorResponseDto,
      },
      { status: 500, description: 'Unexpected server error', type: ApiErrorResponseDto },
    );
  for (const [name, description] of TAGS) builder.addTag(name, description);

  const document = SwaggerModule.createDocument(app, builder.build());
  if (!config.devTools.enabled) {
    for (const path of Object.keys(document.paths)) {
      if (path.startsWith('/api/v1/dev/')) delete document.paths[path];
    }
    document.tags = document.tags?.filter((tag) => tag.name !== 'Dev tools');
  }
  return document;
}

export function setupSwagger(app: NestExpressApplication, config: AppConfig): void {
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app, config), {
    customSiteTitle: 'My Movie Catalog API',
    jsonDocumentUrl: 'api/docs/openapi.json',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tryItOutEnabled: true,
      displayRequestDuration: true,
      defaultModelsExpandDepth: -1,
      responseInterceptor: swaggerAutoAuthorize,
    },
  });
}
