import { Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { displayName } from '../common/utils/display-name.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { profiles } from '../database/schema/index.js';

export interface PersonView {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
}

/** Public-facing identity of users (names and avatars; never email addresses). */
@Injectable()
export class UserDirectoryService {
  constructor(@InjectDb() private readonly db: Database) {}

  async people(ids: string[]): Promise<Map<string, PersonView>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        username: profiles.username,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(inArray(profiles.id, unique));
    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          displayName: displayName(row),
          username: row.username,
          avatarUrl: row.avatarUrl,
        },
      ]),
    );
  }

  async person(id: string): Promise<PersonView | undefined> {
    return (await this.people([id])).get(id);
  }

  async displayNameOf(id: string): Promise<string> {
    return (await this.person(id))?.displayName ?? 'Someone';
  }

  async findIdByEmail(email: string): Promise<string | undefined> {
    const [row] = await this.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, email));
    return row?.id;
  }
}
