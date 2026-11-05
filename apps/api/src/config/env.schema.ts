import { z } from 'zod';

const booleanFlag = z
  .enum(['true', 'false', '1', '0', 'yes', 'no'])
  .transform((value) => value === 'true' || value === '1' || value === 'yes');

const optionalSecret = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined));

/** Treats `VAR=` (empty) like an unset variable. */
const blankAsUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalUrl = z.preprocess(blankAsUndefined, z.url().optional());
const optionalFlag = z.preprocess(blankAsUndefined, booleanFlag.optional());

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

/** Every environment variable the API reads. See apps/api/.env.example for documentation. */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'log', 'debug', 'verbose']).default('log'),
    LOG_FORMAT: z.enum(['pretty', 'json']).default('pretty'),
    TRUST_PROXY: booleanFlag.default(false),
    CORS_ORIGINS: csv.default(['http://localhost:3000', 'http://127.0.0.1:3000']),
    WEB_APP_URL: z.url().default('http://localhost:3000'),
    /** Public base URL of this API (defaults to http://HOST:PORT). Used for links to the API itself. */
    PUBLIC_API_URL: optionalUrl,
    SWAGGER_ENABLED: booleanFlag.default(true),
    JOBS_ENABLED: booleanFlag.default(true),
    /** Developer endpoints under /api/v1/dev (quick sign-in, mailbox, demo data). */
    DEV_TOOLS_ENABLED: optionalFlag,
    MAILPIT_URL: z.url().default('http://127.0.0.1:54324'),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (run `npm run env:sync`)'),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

    SUPABASE_URL: z.url(),
    SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required (run `npm run env:sync`)'),
    SUPABASE_SERVICE_ROLE_KEY: z
      .string()
      .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required (run `npm run env:sync`)'),
    SUPABASE_JWT_SECRET: optionalSecret,
    SUPABASE_STORAGE_BUCKET: z.string().default('media'),

    /** `auto` = live with a key, mock in development without one, offline otherwise. */
    TMDB_MODE: z.preprocess(
      blankAsUndefined,
      z.enum(['auto', 'live', 'mock', 'offline']).default('auto'),
    ),
    TMDB_API_READ_ACCESS_TOKEN: optionalSecret,
    TMDB_API_KEY: optionalSecret,
    TMDB_BASE_URL: z.url().default('https://api.themoviedb.org/3'),
    TMDB_IMAGE_BASE_URL: optionalUrl,
    TMDB_DEFAULT_LANGUAGE: z.string().default('en-US'),
    TMDB_DEFAULT_REGION: z.string().length(2).default('US'),
    TMDB_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
    /** Artificial delay for mock TMDB responses (to see loading states in the UI). */
    TMDB_MOCK_LATENCY_MS: z.coerce.number().int().min(0).max(10_000).default(0),

    SMTP_HOST: z.string().default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().int().positive().default(54325),
    SMTP_SECURE: booleanFlag.default(false),
    SMTP_USER: optionalSecret,
    SMTP_PASSWORD: optionalSecret,
    MAIL_FROM: z.string().default('My Movie Catalog <no-reply@my-movie-catalog.local>'),

    OTP_EXPIRY_SECONDS: z.coerce.number().int().positive().default(600),
    OTP_RESEND_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
    OTP_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().default(5),
    OTP_REQUESTS_PER_HOUR_PER_EMAIL: z.coerce.number().int().positive().default(10),
    OTP_REQUESTS_PER_HOUR_PER_IP: z.coerce.number().int().positive().default(30),
    OTP_VERIFICATIONS_PER_15_MIN_PER_IP: z.coerce.number().int().positive().default(60),

    INVITATION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.DEV_TOOLS_ENABLED) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEV_TOOLS_ENABLED'],
        message: 'developer tools must never be enabled in production',
      });
    }
    if (env.TMDB_MODE === 'live' && !env.TMDB_API_READ_ACCESS_TOKEN && !env.TMDB_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['TMDB_MODE'],
        message: 'TMDB_MODE=live requires TMDB_API_READ_ACCESS_TOKEN or TMDB_API_KEY',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}
