import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { badRequest, serviceUnavailable } from '../common/errors.js';
import { AppConfig } from '../config/app-config.js';
import { SupabaseService } from '../supabase/supabase.service.js';

/** The parts of an uploaded file the API uses (shape of multer's memory-storage file). */
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const SIGNATURES: { type: string; extension: string; matches: (b: Buffer) => boolean }[] = [
  {
    type: 'image/png',
    extension: 'png',
    matches: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    type: 'image/jpeg',
    extension: 'jpg',
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: 'image/webp',
    extension: 'webp',
    matches: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

/** Detects the real image type from the file's first bytes (the declared type is not trusted). */
export function detectImageType(buffer: Buffer): { type: string; extension: string } | null {
  const match = SIGNATURES.find((signature) => signature.matches(buffer));
  return match ? { type: match.type, extension: match.extension } : null;
}

/** Stores user images (avatars, group pictures, collection covers) in Supabase Storage. */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: AppConfig,
  ) {}

  async uploadImage(folder: string, file: UploadedImage | undefined): Promise<string> {
    if (!file) throw badRequest('FILE_REQUIRED', 'Attach an image in the "file" field.');
    if (file.size > MAX_IMAGE_BYTES)
      throw badRequest('FILE_TOO_LARGE', 'Images must be 2 MB or smaller.');
    const detected = detectImageType(file.buffer);
    if (!detected) throw badRequest('UNSUPPORTED_IMAGE', 'Upload a PNG, JPEG or WebP image.');

    const path = `${folder}/${randomUUID()}.${detected.extension}`;
    const bucket = this.supabase.admin.storage.from(this.config.supabase.storageBucket);
    const { error } = await bucket.upload(path, file.buffer, {
      contentType: detected.type,
      upsert: false,
    });
    if (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw serviceUnavailable('UPLOAD_FAILED', 'The image could not be stored. Please try again.');
    }
    return bucket.getPublicUrl(path).data.publicUrl;
  }

  /** Deletes an image previously returned by `uploadImage` (other URLs are ignored). */
  async removeByUrl(url: string | null | undefined): Promise<void> {
    const path = this.pathFromUrl(url);
    if (!path) return;
    const { error } = await this.supabase.admin.storage
      .from(this.config.supabase.storageBucket)
      .remove([path]);
    if (error) this.logger.warn(`Could not delete ${path}: ${error.message}`);
  }

  async removeFolder(folder: string): Promise<void> {
    const bucket = this.supabase.admin.storage.from(this.config.supabase.storageBucket);
    const { data } = await bucket.list(folder, { limit: 1000 });
    const paths = (data ?? []).map((object) => `${folder}/${object.name}`);
    if (paths.length > 0) await bucket.remove(paths);
  }

  private pathFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const prefix = `${this.config.supabase.url}/storage/v1/object/public/${this.config.supabase.storageBucket}/`;
    return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
  }
}
