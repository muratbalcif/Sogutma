import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { EnvironmentVariables } from '../../config/env.validation';

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly maxBytes: number;
  private readonly presignTtlSeconds: number;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    const accountId = this.config.get('R2_ACCOUNT_ID', { infer: true }) ?? '';
    const accessKeyId =
      this.config.get('R2_ACCESS_KEY_ID', { infer: true }) ?? '';
    const secretAccessKey =
      this.config.get('R2_SECRET_ACCESS_KEY', { infer: true }) ?? '';
    this.bucket = this.config.get('R2_BUCKET', { infer: true }) ?? '';
    this.publicUrl = (
      this.config.get('R2_PUBLIC_URL', { infer: true }) ?? ''
    ).replace(/\/$/, '');
    this.maxBytes =
      this.config.get('R2_MAX_UPLOAD_BYTES', { infer: true }) ??
      5 * 1024 * 1024;
    this.presignTtlSeconds =
      this.config.get('R2_PRESIGN_TTL_SECONDS', { infer: true }) ?? 300;

    if (accountId && accessKeyId && secretAccessKey && this.bucket) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      this.client = null;
      this.logger.warn(
        'R2 credentials incomplete — uploads will return ServiceUnavailable until configured',
      );
    }
  }

  isConfigured(): boolean {
    return this.client !== null && Boolean(this.publicUrl);
  }

  assertImageContentType(contentType: string): void {
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WEBP images are allowed',
      );
    }
  }

  assertSafeImageFilename(filename: string): void {
    const lower = (filename || '').toLowerCase();
    if (
      lower.includes('.svg') ||
      lower.includes('.html') ||
      lower.includes('.js')
    ) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WEBP filenames are allowed',
      );
    }
    if (!/\.(jpe?g|png|webp)$/.test(lower)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WEBP filenames are allowed',
      );
    }
  }

  assertUploadSize(contentLength: number): void {
    if (!Number.isFinite(contentLength) || contentLength < 1) {
      throw new BadRequestException('contentLength is required');
    }
    if (contentLength > this.maxBytes) {
      throw new BadRequestException(
        `File exceeds max upload size (${this.maxBytes} bytes)`,
      );
    }
  }

  buildObjectKey(
    folder: string,
    filename: string,
    contentType: string,
  ): string {
    const safeFolder = folder
      .replace(/[^a-zA-Z0-9/_-]/g, '')
      .replace(/^\/+|\/+$/g, '')
      .slice(0, 120);
    const ext =
      EXT_BY_TYPE[contentType] ??
      (extname(filename)
        .toLowerCase()
        .match(/^\.(jpe?g|png|webp)$/)
        ? extname(filename).toLowerCase()
        : '.bin');
    return `${safeFolder || 'uploads'}/${randomUUID()}${ext}`;
  }

  publicUrlForKey(objectKey: string): string {
    if (!this.publicUrl) {
      throw new ServiceUnavailableException('R2_PUBLIC_URL is not configured');
    }
    return `${this.publicUrl}/${objectKey.replace(/^\//, '')}`;
  }

  async createPresignedUpload(input: {
    filename: string;
    contentType: string;
    folder: string;
    contentLength: number;
  }): Promise<{
    uploadUrl: string;
    objectKey: string;
    publicUrl: string;
    maxBytes: number;
  }> {
    this.assertImageContentType(input.contentType);
    this.assertSafeImageFilename(input.filename);
    this.assertUploadSize(input.contentLength);
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException('Object storage is not configured');
    }

    const objectKey = this.buildObjectKey(
      input.folder,
      input.filename,
      input.contentType,
    );
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.presignTtlSeconds,
    });
    return {
      uploadUrl,
      objectKey,
      publicUrl: this.publicUrlForKey(objectKey),
      maxBytes: this.maxBytes,
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    if (!objectKey) {
      return;
    }
    if (!this.client || !this.bucket) {
      this.logger.warn(`Skip R2 delete (not configured): ${objectKey}`);
      return;
    }
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'R2 delete fail';
      this.logger.error(`R2 delete failed for ${objectKey}: ${message}`);
      // Orphan cleanup can sweep later; DB delete already committed.
    }
  }

  getMaxUploadBytes(): number {
    return this.maxBytes;
  }
}
