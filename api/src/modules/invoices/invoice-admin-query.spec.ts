/* eslint-disable @typescript-eslint/no-unsafe-assignment -- jest asymmetric matchers */
import { NotFoundException } from '@nestjs/common';
import { InvoiceDocumentType, InvoiceStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  resolveCanFormalize,
  resolveCanRetry,
  resolveInvoiceDisplayStatus,
} from './dto/invoice-query.dto';
import { InvoicesService } from './invoices.service';
import type { InvoiceProvider } from './providers/invoice-provider.interface';
import { KOLAYBI_INVOICE_PROVIDER } from './providers/invoice-provider.interface';

describe('invoice display / action flags', () => {
  it('maps SUCCESS+uuid null to DRAFT', () => {
    expect(resolveInvoiceDisplayStatus(InvoiceStatus.SUCCESS, null)).toBe(
      'DRAFT',
    );
  });

  it('maps SUCCESS+uuid to FORMALIZED', () => {
    expect(resolveInvoiceDisplayStatus(InvoiceStatus.SUCCESS, 'u')).toBe(
      'FORMALIZED',
    );
  });

  it('canFormalize only for draft with external id', () => {
    expect(
      resolveCanFormalize({
        status: InvoiceStatus.SUCCESS,
        uuid: null,
        externalDocumentId: '1',
      }),
    ).toBe(true);
    expect(
      resolveCanFormalize({
        status: InvoiceStatus.SUCCESS,
        uuid: 'ettn',
        externalDocumentId: '1',
      }),
    ).toBe(false);
    expect(
      resolveCanFormalize({
        status: InvoiceStatus.FAILED,
        uuid: null,
        externalDocumentId: '1',
      }),
    ).toBe(false);
  });

  it('canRetry only for known retryable codes', () => {
    expect(
      resolveCanRetry({
        status: InvoiceStatus.SUCCESS,
        uuid: null,
        externalDocumentId: '1',
        errorCode: 'FORMALIZE_UNKNOWN',
      }),
    ).toBe(true);
    expect(
      resolveCanRetry({
        status: InvoiceStatus.FAILED,
        uuid: null,
        externalDocumentId: null,
        errorCode: 'KOLAYBI_VALIDATION_ERROR',
      }),
    ).toBe(false);
    expect(
      resolveCanRetry({
        status: InvoiceStatus.FAILED,
        uuid: null,
        externalDocumentId: null,
        errorCode: 'KOLAYBI_TIMEOUT',
      }),
    ).toBe(true);
  });
});

describe('InvoicesService list/detail', () => {
  const provider: InvoiceProvider = {
    code: KOLAYBI_INVOICE_PROVIDER,
    enabled: true,
    authenticate: jest.fn(),
    healthCheck: jest.fn(),
    ensureCustomer: jest.fn(),
    ensureAddress: jest.fn(),
    ensureProduct: jest.fn(),
    createInvoice: jest.fn(),
    formalizeInvoice: jest.fn(),
    getInvoiceDocument: jest.fn(),
    getInvoiceRemoteState: jest.fn(),
  };

  const prisma = {
    invoice: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const service = new InvoicesService([provider], prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists invoices with pagination and flags', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      {
        id: 'inv1',
        saleId: 'sale1',
        customerId: 'c1',
        provider: 'KOLAYBI',
        documentType: InvoiceDocumentType.E_ARCHIVE,
        status: InvoiceStatus.SUCCESS,
        externalDocumentId: '18',
        invoiceNumber: 'S1',
        uuid: null,
        currency: 'TRY',
        totalAmount: new Prisma.Decimal('120.00'),
        errorCode: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sale: { id: 'sale1', saleNumber: 'S2026-1' },
        customer: {
          id: 'c1',
          firstName: 'Ahmet',
          lastName: 'Yılmaz',
          email: 'a@x.com',
        },
      },
    ]);
    prisma.invoice.count.mockResolvedValue(1);

    const result = await service.list({ page: 1, limit: 20 });
    expect(result.meta.total).toBe(1);
    expect(result.items[0]?.displayStatus).toBe('DRAFT');
    expect(result.items[0]?.canFormalize).toBe(true);
    expect(result.items[0]?.canDownloadPdf).toBe(false);
    expect(result.items[0]?.canSync).toBe(true);
    expect(result.items[0]?.customerLabel).toContain('Ahmet');
  });

  it('returns detail with snapshot and createdBy', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv1',
      saleId: 'sale1',
      customerId: 'c1',
      provider: 'KOLAYBI',
      documentType: InvoiceDocumentType.E_ARCHIVE,
      status: InvoiceStatus.SUCCESS,
      externalDocumentId: '18',
      invoiceNumber: 'HDB1',
      uuid: 'ettn-1',
      currency: 'TRY',
      subtotal: new Prisma.Decimal('100.00'),
      discountAmount: new Prisma.Decimal('0'),
      taxAmount: new Prisma.Decimal('20.00'),
      totalAmount: new Prisma.Decimal('120.00'),
      errorCode: null,
      errorMessage: null,
      billingAddressId: 'a1',
      billingAddressSnapshot: {
        firstName: 'Ahmet',
        city: 'İstanbul',
        addressLine: 'Cad',
      },
      issuedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      sale: { id: 'sale1', saleNumber: 'S2026-1' },
      customer: {
        id: 'c1',
        firstName: 'Ahmet',
        lastName: 'Yılmaz',
        email: 'a@x.com',
      },
      createdBy: {
        id: 'admin1',
        firstName: 'Murat',
        lastName: 'B',
        email: 'm@x.com',
      },
    });

    const detail = await service.getDetail('inv1');
    expect(detail.displayStatus).toBe('FORMALIZED');
    expect(detail.canFormalize).toBe(false);
    expect(detail.canDownloadPdf).toBe(true);
    expect(detail.canDownloadXml).toBe(true);
    expect(detail.canSync).toBe(true);
    expect(detail.billingAddressSnapshot.city).toBe('İstanbul');
    expect(detail.createdBy.email).toBe('m@x.com');
    expect(detail.subtotal).toBe('100.00');
  });

  it('throws when invoice missing', async () => {
    prisma.invoice.findUnique.mockResolvedValue(null);
    await expect(service.getDetail('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('applies status, saleId and formalized filters', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.count.mockResolvedValue(0);

    await service.list({
      page: 1,
      limit: 10,
      status: InvoiceStatus.SUCCESS,
      saleId: 'sale-1',
      formalized: 'false',
    });

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: InvoiceStatus.SUCCESS,
          saleId: 'sale-1',
          uuid: null,
        }),
        take: 10,
        skip: 0,
      }),
    );
  });

  it('applies search across invoice and sale fields', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.count.mockResolvedValue(0);

    await service.list({ page: 2, limit: 5, search: 'ABC' });

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              invoiceNumber: expect.objectContaining({ contains: 'ABC' }),
            }),
            expect.objectContaining({
              sale: expect.anything(),
            }),
          ]),
        }),
      }),
    );
  });

  it('marks formalized SUCCESS as not formalizable', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      {
        id: 'inv2',
        saleId: 'sale1',
        customerId: 'c1',
        provider: 'KOLAYBI',
        documentType: InvoiceDocumentType.E_INVOICE,
        status: InvoiceStatus.SUCCESS,
        externalDocumentId: '18',
        invoiceNumber: 'S2',
        uuid: 'ettn',
        currency: 'TRY',
        totalAmount: new Prisma.Decimal('10.00'),
        errorCode: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sale: { id: 'sale1', saleNumber: 'S2026-1' },
        customer: {
          id: 'c1',
          firstName: 'A',
          lastName: 'B',
          email: 'a@x.com',
        },
      },
    ]);
    prisma.invoice.count.mockResolvedValue(1);

    const result = await service.list({ page: 1, limit: 20 });
    expect(result.items[0]?.displayStatus).toBe('FORMALIZED');
    expect(result.items[0]?.canFormalize).toBe(false);
    expect(result.items[0]?.canRetry).toBe(false);
  });
});
