import { parseEnv, type Env } from './env.schema.js';

/**
 * Where movie data comes from:
 * - `live`: the real TMDB API (needs a key),
 * - `mock`: a built-in dataset shaped exactly like TMDB responses (no key, no network),
 * - `offline`: only the local catalog (bundled sample movies and saved movies).
 */
export type TmdbMode = 'live' | 'mock' | 'offline';

export function resolveTmdbMode(
  env: Pick<Env, 'TMDB_MODE' | 'TMDB_API_READ_ACCESS_TOKEN' | 'TMDB_API_KEY' | 'NODE_ENV'>,
): TmdbMode {
  if (env.TMDB_MODE !== 'auto') return env.TMDB_MODE;
  if (env.TMDB_API_READ_ACCESS_TOKEN ?? env.TMDB_API_KEY) return 'live';
  return env.NODE_ENV === 'development' ? 'mock' : 'offline';
}

/** Typed, validated application configuration. Inject it like any other provider. */
export class AppConfig {
  readonly nodeEnv: Env['NODE_ENV'];
  readonly http: {
    host: string;
    port: number;
    trustProxy: boolean;
    corsOrigins: string[];
    webAppUrl: string;
    swaggerEnabled: boolean;
    rateLimitPerMinute: number;
    /** Public base URL of this API, without a trailing slash. */
    publicUrl: string;
  };
  readonly logging: { level: Env['LOG_LEVEL']; format: Env['LOG_FORMAT'] };
  readonly database: { url: string; poolMax: number };
  readonly supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
    jwtSecret: string | undefined;
    storageBucket: string;
  };
  readonly tmdb: {
    mode: TmdbMode;
    /** True in live and mock mode: the TMDB code paths are used. */
    enabled: boolean;
    /** True in mock mode: requests are answered by the built-in mock dataset. */
    mock: boolean;
    mockLatencyMs: number;
    readAccessToken: string | undefined;
    apiKey: string | undefined;
    baseUrl: string;
    imageBaseUrl: string;
    defaultLanguage: string;
    defaultRegion: string;
    timeoutMs: number;
  };
  readonly mail: {
    host: string;
    port: number;
    secure: boolean;
    user: string | undefined;
    password: string | undefined;
    from: string;
  };
  readonly auth: {
    otpExpirySeconds: number;
    otpResendIntervalSeconds: number;
    otpMaxFailedAttempts: number;
    otpRequestsPerHourPerEmail: number;
    otpRequestsPerHourPerIp: number;
    otpVerificationsPer15MinPerIp: number;
  };
  readonly invitations: { ttlDays: number };
  readonly jobsEnabled: boolean;
  readonly devTools: { enabled: boolean; mailpitUrl: string };
  readonly demoAccounts: { enabled: boolean };

  constructor(env: Env) {
    this.nodeEnv = env.NODE_ENV;
    const localHost = env.HOST === '0.0.0.0' || env.HOST === '::' ? '127.0.0.1' : env.HOST;
    const publicUrl = (env.PUBLIC_API_URL ?? `http://${localHost}:${env.PORT}`).replace(/\/+$/, '');
    this.http = {
      host: env.HOST,
      port: env.PORT,
      trustProxy: env.TRUST_PROXY,
      corsOrigins: env.CORS_ORIGINS,
      webAppUrl: env.WEB_APP_URL.replace(/\/+$/, ''),
      swaggerEnabled: env.SWAGGER_ENABLED,
      rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
      publicUrl,
    };
    this.logging = { level: env.LOG_LEVEL, format: env.LOG_FORMAT };
    this.database = { url: env.DATABASE_URL, poolMax: env.DATABASE_POOL_MAX };
    this.supabase = {
      url: env.SUPABASE_URL.replace(/\/+$/, ''),
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      jwtSecret: env.SUPABASE_JWT_SECRET,
      storageBucket: env.SUPABASE_STORAGE_BUCKET,
    };
    const mode = resolveTmdbMode(env);
    this.tmdb = {
      mode,
      enabled: mode !== 'offline',
      mock: mode === 'mock',
      mockLatencyMs: env.TMDB_MOCK_LATENCY_MS,
      readAccessToken: env.TMDB_API_READ_ACCESS_TOKEN,
      apiKey: env.TMDB_API_KEY,
      baseUrl: env.TMDB_BASE_URL.replace(/\/+$/, ''),
      imageBaseUrl: (
        env.TMDB_IMAGE_BASE_URL ??
        (mode === 'mock' ? `${publicUrl}/api/v1/mock-tmdb/images` : 'https://image.tmdb.org/t/p')
      ).replace(/\/+$/, ''),
      defaultLanguage: env.TMDB_DEFAULT_LANGUAGE,
      defaultRegion: env.TMDB_DEFAULT_REGION.toUpperCase(),
      timeoutMs: env.TMDB_TIMEOUT_MS,
    };
    this.mail = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.MAIL_FROM,
    };
    this.auth = {
      otpExpirySeconds: env.OTP_EXPIRY_SECONDS,
      otpResendIntervalSeconds: env.OTP_RESEND_INTERVAL_SECONDS,
      otpMaxFailedAttempts: env.OTP_MAX_FAILED_ATTEMPTS,
      otpRequestsPerHourPerEmail: env.OTP_REQUESTS_PER_HOUR_PER_EMAIL,
      otpRequestsPerHourPerIp: env.OTP_REQUESTS_PER_HOUR_PER_IP,
      otpVerificationsPer15MinPerIp: env.OTP_VERIFICATIONS_PER_15_MIN_PER_IP,
    };
    this.invitations = { ttlDays: env.INVITATION_TTL_DAYS };
    this.jobsEnabled = env.JOBS_ENABLED;
    this.devTools = {
      enabled: env.DEV_TOOLS_ENABLED ?? env.NODE_ENV === 'development',
      mailpitUrl: env.MAILPIT_URL.replace(/\/+$/, ''),
    };
    this.demoAccounts = { enabled: env.DEMO_ACCOUNTS_ENABLED ?? false };
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  static fromEnvironment(source: Record<string, string | undefined> = process.env): AppConfig {
    return new AppConfig(parseEnv(source));
  }
}
