import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const;

const ALLOWED_MIMES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export function spreadsheetFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
): void {
  try {
    assertSpreadsheetFile(file.originalname, file.mimetype);
    cb(null, true);
  } catch (error) {
    cb(
      error instanceof Error ? error : new BadRequestException('Invalid file'),
      false,
    );
  }
}

export function assertSpreadsheetFile(
  originalname: string,
  mimetype?: string,
): void {
  const name = (originalname || '').toLowerCase();
  if (
    name.endsWith('.xlsm') ||
    name.endsWith('.xlsb') ||
    name.includes('.svg')
  ) {
    throw new BadRequestException('Only CSV and XLSX files are supported');
  }
  const extOk = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!extOk) {
    throw new BadRequestException('Only CSV and XLSX files are supported');
  }
  const mime = (mimetype || '').toLowerCase().split(';')[0].trim();
  if (mime && !ALLOWED_MIMES.has(mime)) {
    throw new BadRequestException('Invalid spreadsheet MIME type');
  }
}
