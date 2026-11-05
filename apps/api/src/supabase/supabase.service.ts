import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import type { ClientContext } from '../auth/auth.types.js';
import { AppConfig } from '../config/app-config.js';

const SERVER_AUTH_OPTIONS = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

export type ServerSupabaseClient = ReturnType<typeof createClient>;

@Injectable()
export class SupabaseService {
  /** Service-role client for admin operations (sign-out, user deletion, storage uploads). */
  readonly admin: ServerSupabaseClient;

  constructor(private readonly config: AppConfig) {
    this.admin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: SERVER_AUTH_OPTIONS,
    });
  }

  /**
   * A fresh client for one passwordless operation (send / verify a code, refresh a session).
   * A new instance per call keeps one user's session from ever leaking into another request.
   * The caller's user agent and IP are forwarded so Supabase records the real device on the
   * session and applies its per-IP limits to the real client.
   */
  createAuthClient(client?: ClientContext): ServerSupabaseClient {
    const headers: Record<string, string> = {};
    if (client?.userAgent) headers['User-Agent'] = client.userAgent;
    if (client?.ip) headers['X-Forwarded-For'] = client.ip;
    return createClient(this.config.supabase.url, this.config.supabase.anonKey, {
      auth: SERVER_AUTH_OPTIONS,
      global: { headers },
    });
  }
}
