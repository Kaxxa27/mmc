import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types.js';
import { AppConfig } from '../config/app-config.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { profiles } from '../database/schema/index.js';

export interface Locale {
  /** TMDB language, e.g. `en-US`. */
  language: string;
  /** ISO 3166-1 region, e.g. `US`. */
  region: string;
}

/** Language/region for movie data: query parameter > user profile > server default. */
@Injectable()
export class LocaleService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly config: AppConfig,
  ) {}

  async resolve(user: AuthUser | undefined, query: Partial<Locale>): Promise<Locale> {
    let profile: { language: string; region: string } | undefined;
    if (user && (!query.language || !query.region)) {
      [profile] = await this.db
        .select({ language: profiles.language, region: profiles.region })
        .from(profiles)
        .where(eq(profiles.id, user.id));
    }
    return {
      language: query.language ?? profile?.language ?? this.config.tmdb.defaultLanguage,
      region: (query.region ?? profile?.region ?? this.config.tmdb.defaultRegion).toUpperCase(),
    };
  }
}
