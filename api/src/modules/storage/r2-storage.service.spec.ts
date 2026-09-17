import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { R2StorageService } from './r2-storage.service';

describe('R2StorageService upload guards', () => {
  const config = {
    get: (key: string) => {
      if (key === 'R2_MAX_UPLOAD_BYTES') return 1024;
      return '';
    },
  } as unknown as ConfigService;

  const service = new R2StorageService(config);

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
});
