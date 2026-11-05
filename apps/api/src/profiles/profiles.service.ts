import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { badRequest, conflict, notFound } from '../common/errors.js';
import { displayName } from '../common/utils/display-name.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { isUniqueViolation } from '../database/pg-errors.js';
import { profiles } from '../database/schema/index.js';
import { MediaService, type UploadedImage } from '../media/media.service.js';
import { GenresService } from '../movies/genres.service.js';
import type { GenreRef } from '../movies/movie.types.js';
import type { UpdateProfileDto } from './dto/profile.dto.js';

type ProfileRow = typeof profiles.$inferSelect;

export interface ProfileView {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  language: string;
  region: string;
  favoriteGenres: GenreRef[];
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ProfilesService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly genres: GenresService,
    private readonly media: MediaService,
  ) {}

  async get(userId: string): Promise<ProfileView> {
    return this.toView(await this.row(userId));
  }

  async update(
    userId: string,
    dto: UpdateProfileDto,
    completeOnboarding = false,
  ): Promise<ProfileView> {
    if (dto.favoriteGenreIds?.some((id) => !this.genres.has(id))) {
      throw badRequest('UNKNOWN_GENRE', 'One or more genres do not exist.');
    }
    const changes: PgUpdateSetSource<typeof profiles> = {
      ...(dto.username !== undefined ? { username: dto.username } : {}),
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
      ...(dto.language !== undefined ? { language: dto.language } : {}),
      ...(dto.region !== undefined ? { region: dto.region } : {}),
      ...(dto.favoriteGenreIds !== undefined ? { favoriteGenreIds: dto.favoriteGenreIds } : {}),
    };
    if (completeOnboarding) {
      changes.onboardingCompletedAt = sql`coalesce(${profiles.onboardingCompletedAt}, now())`;
    }
    if (Object.keys(changes).length === 0) return this.get(userId);
    try {
      const [row] = await this.db
        .update(profiles)
        .set(changes)
        .where(eq(profiles.id, userId))
        .returning();
      if (!row) throw notFound('PROFILE_NOT_FOUND', 'Profile not found.');
      return this.toView(row);
    } catch (error) {
      if (isUniqueViolation(error, 'profiles_username_key')) {
        throw conflict('USERNAME_TAKEN', 'This username is already taken.');
      }
      throw error;
    }
  }

  async isUsernameAvailable(userId: string, username: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, username));
    return !row || row.id === userId;
  }

  async setAvatar(userId: string, file: UploadedImage | undefined): Promise<ProfileView> {
    const current = await this.row(userId);
    const url = await this.media.uploadImage(`users/${userId}/avatar`, file);
    const [row] = await this.db
      .update(profiles)
      .set({ avatarUrl: url })
      .where(eq(profiles.id, userId))
      .returning();
    await this.media.removeByUrl(current.avatarUrl);
    return this.toView(row ?? current);
  }

  async removeAvatar(userId: string): Promise<ProfileView> {
    const current = await this.row(userId);
    const [row] = await this.db
      .update(profiles)
      .set({ avatarUrl: null })
      .where(eq(profiles.id, userId))
      .returning();
    await this.media.removeByUrl(current.avatarUrl);
    return this.toView(row ?? current);
  }

  private async row(userId: string): Promise<ProfileRow> {
    const [row] = await this.db.select().from(profiles).where(eq(profiles.id, userId));
    if (!row) throw notFound('PROFILE_NOT_FOUND', 'Profile not found.');
    return row;
  }

  private toView(row: ProfileRow): ProfileView {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      displayName: displayName(row),
      bio: row.bio,
      avatarUrl: row.avatarUrl,
      language: row.language,
      region: row.region,
      favoriteGenres: this.genres.refs(row.favoriteGenreIds),
      onboardingCompleted: row.onboardingCompletedAt !== null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
