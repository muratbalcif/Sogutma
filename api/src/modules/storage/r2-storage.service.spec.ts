import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { R2StorageService } from './r2-storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://r2.example/presigned-put'),
}));

const sendMock = jest.fn().mockResolvedValue({});

jest.mock('@aws-sdk/client-s3', () => {
  // Jest mock factory: requireActual is loosely typed.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest.requireActual
  const actual = jest.requireActual('@aws-sdk/client-s3');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- spread mock module
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({
      send: sendMock,
    })),
  };
});

function makeConfig(
  overrides: Record<string, string | number | undefined> = {},
): ConfigService {
  const values: Record<string, string | number | undefined> = {
    R2_ACCOUNT_ID: 'acct',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: 'furkansogutma-prod',
    R2_PUBLIC_URL: 'https://media.furkansogutma.net',
    R2_MAX_UPLOAD_BYTES: 5 * 1024 * 1024,
    R2_PRESIGN_TTL_SECONDS: 300,
    ...overrides,
  };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('R2StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'https://r2.example/presigned-put',
    );
  });

  describe('upload guards', () => {
    const service = new R2StorageService(
      makeConfig({ R2_MAX_UPLOAD_BYTES: 1024 }),
    );

    it('rejects SVG MIME', () => {
      expect(() => service.assertImageContentType('image/svg+xml')).toThrow(
        BadRequestException,
      );
    });

    it('rejects dangerous extensions', () => {
      expect(() => service.assertSafeImageFilename('payload.svg')).toThrow(
        BadRequestException,
      );
      expect(() => service.assertSafeImageFilename('x.jpg.exe')).toThrow(
        BadRequestException,
      );
    });

    it('rejects oversized contentLength', () => {
      expect(() => service.assertUploadSize(2048)).toThrow(BadRequestException);
    });

    it('accepts jpeg within limit', () => {
      expect(() => service.assertImageContentType('image/jpeg')).not.toThrow();
      expect(() => service.assertSafeImageFilename('klima.webp')).not.toThrow();
      expect(() => service.assertUploadSize(512)).not.toThrow();
    });

    it('rejects folder traversal', () => {
      expect(() => service.assertSafeFolder('products/../etc')).toThrow(
        BadRequestException,
      );
      expect(() => service.assertSafeFolder('/absolute')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('when configured', () => {
    let service: R2StorageService;

    beforeEach(() => {
      service = new R2StorageService(makeConfig());
    });

    it('isConfigured is true', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('builds public URL from object key', () => {
      expect(service.publicUrlForKey('products/abc.jpg')).toBe(
        'https://media.furkansogutma.net/products/abc.jpg',
      );
    });

    it('creates presigned upload URL without exposing secrets', async () => {
      const result = await service.createPresignedUpload({
        filename: 'klima.jpg',
        contentType: 'image/jpeg',
        folder: 'products/demo',
        contentLength: 1024,
      });

      expect(result.uploadUrl).toBe('https://r2.example/presigned-put');
      expect(result.objectKey).toMatch(/^products\/demo\/[0-9a-f-]{36}\.jpg$/i);
      expect(result.publicUrl).toBe(
        `https://media.furkansogutma.net/${result.objectKey}`,
      );
      expect(result.maxBytes).toBe(5 * 1024 * 1024);
      expect(result.expiresIn).toBe(300);
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PutObjectCommand),
        expect.objectContaining({ expiresIn: 300 }),
      );
      expect(result.uploadUrl).not.toMatch(/secret|ACCESS_KEY/i);
      expect(result.publicUrl).toMatch(
        /^https:\/\/media\.furkansogutma\.net\//,
      );
    });

    it('deletes with safe object key', async () => {
      await service.deleteObject('products/abc-def.jpg');
      expect(sendMock).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    it('skips delete for unsafe object key', async () => {
      await service.deleteObject('../etc/passwd.jpg');
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('validates registered image URL matches CDN + key', () => {
      const key = 'products/11111111-1111-4111-8111-111111111111.jpg';
      expect(() =>
        service.assertRegisteredImageUrl(
          `https://media.furkansogutma.net/${key}`,
          key,
        ),
      ).not.toThrow();
      expect(() =>
        service.assertRegisteredImageUrl('https://evil.example/x.jpg', key),
      ).toThrow(BadRequestException);
    });
  });

  describe('when misconfigured', () => {
    it('reports not configured without credentials', () => {
      const service = new R2StorageService(
        makeConfig({
          R2_ACCOUNT_ID: '',
          R2_ACCESS_KEY_ID: '',
          R2_SECRET_ACCESS_KEY: '',
        }),
      );
      expect(service.isConfigured()).toBe(false);
    });

    it('createPresignedUpload throws ServiceUnavailable', async () => {
      const service = new R2StorageService(
        makeConfig({
          R2_ACCOUNT_ID: '',
          R2_ACCESS_KEY_ID: '',
          R2_SECRET_ACCESS_KEY: '',
        }),
      );
      await expect(
        service.createPresignedUpload({
          filename: 'a.jpg',
          contentType: 'image/jpeg',
          folder: 'products',
          contentLength: 100,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('publicUrlForKey throws when R2_PUBLIC_URL missing', () => {
      const service = new R2StorageService(makeConfig({ R2_PUBLIC_URL: '' }));
      expect(() => service.publicUrlForKey('products/a.jpg')).toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
