import { BadRequestException } from '@nestjs/common';
import { ImportsService } from './imports.service';

describe('ImportsService validation helpers', () => {
  const prisma = {
    brand: { findMany: jest.fn() },
    category: { findMany: jest.fn() },
    product: { findMany: jest.fn(), findFirst: jest.fn() },
    importJob: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    importRowResult: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const inventoryService = {
    increaseStock: jest.fn(),
    decreaseStock: jest.fn(),
    adjustStock: jest.fn(),
  };
  const audit = { log: jest.fn() };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'MAX_IMPORT_ROWS') return 5000;
      if (key === 'IMPORT_BATCH_SIZE') return 100;
      return undefined;
    }),
  };

  const service = new ImportsService(
    prisma as never,
    inventoryService as never,
    audit as never,
    config as never,
  );

  it('rejects unsupported spreadsheet extension', () => {
    expect(() =>
      service.parseSpreadsheet(Buffer.from('x'), 'data.txt'),
    ).toThrow(BadRequestException);
  });

  it('parses CSV columns', () => {
    const csv = 'sku,name,brand,category\nSKU1,Klima,Arcelik,Split\n';
    const rows = service.parseSpreadsheet(Buffer.from(csv), 'products.csv');
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe('SKU1');
    expect(rows[0].name).toBe('Klima');
  });

  it('rejects xlsx buffers that are not zip/PK files', () => {
    expect(() =>
      service.parseSpreadsheet(Buffer.from('not-a-xlsx'), 'evil.xlsx'),
    ).toThrow(BadRequestException);
  });
});
