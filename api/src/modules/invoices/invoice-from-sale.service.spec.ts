/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- jest asymmetric matchers */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvoiceDocumentType,
  InvoiceStatus,
  Prisma,
  SaleStatus,
} from '@prisma/client';
import { KolayBiApiError } from './clients/kolaybi.errors';
import {
  formatBusinessDate,
  InvoiceFromSaleService,
  saleInvoiceIdempotencyKey,
  totalsMatch,
} from './invoice-from-sale.service';
import { InvoicesService } from './invoices.service';
import type { InvoiceProvider } from './providers/invoice-provider.interface';

describe('InvoiceFromSaleService', () => {
  const createInvoice = jest.fn();
  const formalizeInvoice = jest.fn();
  const provider: InvoiceProvider = {
    code: 'KOLAYBI',
    enabled: true,
    authenticate: jest.fn(),
    healthCheck: jest.fn(),
    ensureCustomer: jest.fn(),
    ensureAddress: jest.fn(),
    ensureProduct: jest.fn(),
    createInvoice,
    formalizeInvoice,
    getInvoiceDocument: jest.fn(),
    getInvoiceRemoteState: jest.fn(),
  };

  const invoices = {
    resolveProvider: jest.fn().mockReturnValue(provider),
    assertProviderEnabledPublic: jest.fn(),
    toHttpExceptionPublic: jest.fn((err: unknown) => err),
    syncCustomer: jest.fn(),
    syncAddress: jest.fn(),
    syncProduct: jest.fn(),
  };

  const prisma = {
    sale: { findUnique: jest.fn() },
    invoice: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    address: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const config = {
    get: jest.fn().mockReturnValue('Europe/Istanbul'),
  } as unknown as ConfigService;

  const service = new InvoiceFromSaleService(
    invoices as unknown as InvoicesService,
    prisma as never,
    config,
  );

  const saleId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const adminId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const customerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const addressId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const productId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  const baseSale = {
    id: saleId,
    saleNumber: 'S20260918-0001',
    customerId,
    status: SaleStatus.COMPLETED,
    currency: 'TRY',
    subtotal: new Prisma.Decimal('100.00'),
    discountAmount: new Prisma.Decimal('0.00'),
    taxAmount: new Prisma.Decimal('20.00'),
    totalAmount: new Prisma.Decimal('120.00'),
    createdAt: new Date('2026-09-18T10:00:00Z'),
    customer: {
      id: customerId,
      email: 'c@x.com',
      isEInvoiceTaxpayer: false,
      corporateCustomer: null,
    },
    items: [
      {
        id: 'item1',
        productId,
        productName: 'Kompresör',
        sku: 'FS-001',
        quantity: 1,
        unitPrice: new Prisma.Decimal('120.00'),
        discountAmount: new Prisma.Decimal('0'),
        taxRate: new Prisma.Decimal('20.00'),
        taxAmount: new Prisma.Decimal('20.00'),
        lineSubtotal: new Prisma.Decimal('100.00'),
        lineTotal: new Prisma.Decimal('120.00'),
        createdAt: new Date(),
      },
    ],
  };

  const address = {
    id: addressId,
    userId: customerId,
    title: 'Ev',
    firstName: 'Ahmet',
    lastName: 'Yılmaz',
    phone: '+905551112233',
    city: 'İstanbul',
    district: 'Kadıköy',
    neighborhood: null,
    addressLine: 'Test Cad',
    postalCode: '34710',
    country: 'TR',
    isDefault: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    invoices.resolveProvider.mockReturnValue(provider);
    invoices.toHttpExceptionPublic.mockImplementation((err: unknown) => err);
    prisma.sale.findUnique.mockResolvedValue(baseSale);
    prisma.invoice.findUnique.mockResolvedValue(null);
    prisma.address.findMany.mockResolvedValue([address]);
    prisma.invoice.create.mockImplementation(({ data }: { data: object }) => ({
      id: 'inv1',
      saleId,
      provider: 'KOLAYBI',
      status: InvoiceStatus.PENDING,
      documentType: InvoiceDocumentType.E_ARCHIVE,
      externalDocumentId: null,
      invoiceNumber: null,
      uuid: null,
      currency: 'TRY',
      subtotal: baseSale.subtotal,
      taxAmount: baseSale.taxAmount,
      totalAmount: baseSale.totalAmount,
      errorCode: null,
      errorMessage: null,
      ...data,
    }));
    prisma.invoice.update.mockImplementation(({ data }: { data: object }) => ({
      id: 'inv1',
      saleId,
      provider: 'KOLAYBI',
      status: InvoiceStatus.SUCCESS,
      documentType: InvoiceDocumentType.E_ARCHIVE,
      externalDocumentId: '1854',
      invoiceNumber: 'S20260918-0001',
      uuid: null,
      currency: 'TRY',
      subtotal: baseSale.subtotal,
      taxAmount: baseSale.taxAmount,
      totalAmount: baseSale.totalAmount,
      errorCode: null,
      errorMessage: null,
      ...data,
    }));
    invoices.syncCustomer.mockResolvedValue({ externalId: '10' });
    invoices.syncAddress.mockResolvedValue({ externalId: '20' });
    invoices.syncProduct.mockResolvedValue({ externalId: '30' });
    createInvoice.mockResolvedValue({
      provider: 'KOLAYBI',
      externalDocumentId: '1854',
      invoiceNumber: 'S20260918-0001',
      uuid: null,
      grandTotal: '120.00',
      created: true,
      resolvedExisting: false,
    });
  });

  it('creates invoice from completed sale with customer', async () => {
    const result = await service.createFromSale(saleId, adminId, {});
    expect(result.status).toBe(InvoiceStatus.SUCCESS);
    expect(result.externalDocumentId).toBe('1854');
    expect(result.invoiceNumber).toBe('S20260918-0001');
    expect(result.uuid).toBeNull();
    expect(invoices.syncCustomer).toHaveBeenCalledWith(customerId);
    expect(invoices.syncAddress).toHaveBeenCalledWith(addressId);
    expect(invoices.syncProduct).toHaveBeenCalledWith(productId);
    expect(createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCustomerId: '10',
        providerAddressId: '20',
        lines: [
          expect.objectContaining({
            providerProductId: '30',
            unitPriceExclusive: '100.00',
            vatRate: '20.00',
            quantity: 1,
          }),
        ],
      }),
    );
    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: adminId,
          idempotencyKey: saleInvoiceIdempotencyKey(saleId),
          status: InvoiceStatus.PENDING,
          billingAddressSnapshot: expect.objectContaining({
            firstName: 'Ahmet',
            city: 'İstanbul',
          }),
        }),
      }),
    );
  });

  it('rejects sale without customerId', async () => {
    prisma.sale.findUnique.mockResolvedValue({
      ...baseSale,
      customerId: null,
      customer: null,
    });
    await expect(service.createFromSale(saleId, adminId, {})).rejects.toThrow(
      /müşteri bilgisi/i,
    );
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it('rejects CANCELLED sale', async () => {
    prisma.sale.findUnique.mockResolvedValue({
      ...baseSale,
      status: SaleStatus.CANCELLED,
    });
    await expect(
      service.createFromSale(saleId, adminId, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing sale', async () => {
    prisma.sale.findUnique.mockResolvedValue(null);
    await expect(
      service.createFromSale(saleId, adminId, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects address belonging to another customer', async () => {
    prisma.address.findUnique.mockResolvedValue({
      ...address,
      userId: 'other-user',
    });
    await expect(
      service.createFromSale(saleId, adminId, {
        billingAddressId: addressId,
      }),
    ).rejects.toThrow(/müşteriye ait değil/i);
  });

  it('uses billingAddressId when provided for correct customer', async () => {
    prisma.address.findUnique.mockResolvedValue(address);
    await service.createFromSale(saleId, adminId, {
      billingAddressId: addressId,
    });
    expect(prisma.address.findMany).not.toHaveBeenCalled();
    expect(invoices.syncAddress).toHaveBeenCalledWith(addressId);
  });

  it('uses default address when unambiguous', async () => {
    await service.createFromSale(saleId, adminId, {});
    expect(prisma.address.findMany).toHaveBeenCalled();
  });

  it('requires billingAddressId when multiple non-default addresses', async () => {
    prisma.address.findMany.mockResolvedValue([
      { ...address, id: 'a1', isDefault: false },
      { ...address, id: 'a2', isDefault: false },
    ]);
    await expect(service.createFromSale(saleId, adminId, {})).rejects.toThrow(
      /billingAddressId/i,
    );
  });

  it('derives E_INVOICE for e-invoice taxpayer', async () => {
    prisma.sale.findUnique.mockResolvedValue({
      ...baseSale,
      customer: {
        ...baseSale.customer,
        isEInvoiceTaxpayer: true,
      },
    });
    await service.createFromSale(saleId, adminId, {});
    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentType: InvoiceDocumentType.E_INVOICE,
        }),
      }),
    );
  });

  it('rejects documentType mismatch with taxpayer status', async () => {
    await expect(
      service.createFromSale(saleId, adminId, {
        documentType: InvoiceDocumentType.E_INVOICE,
      }),
    ).rejects.toThrow(/mükellefiyet/i);
  });

  it('returns existing SUCCESS without creating duplicate', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv1',
      saleId,
      status: InvoiceStatus.SUCCESS,
      provider: 'KOLAYBI',
      documentType: InvoiceDocumentType.E_ARCHIVE,
      externalDocumentId: '1854',
      invoiceNumber: 'S20260918-0001',
      uuid: null,
      currency: 'TRY',
      subtotal: baseSale.subtotal,
      taxAmount: baseSale.taxAmount,
      totalAmount: baseSale.totalAmount,
      errorCode: null,
      errorMessage: null,
    });
    const result = await service.createFromSale(saleId, adminId, {});
    expect(result.status).toBe(InvoiceStatus.SUCCESS);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it('retries FAILED invoice in place', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv1',
      saleId,
      status: InvoiceStatus.FAILED,
      provider: 'KOLAYBI',
      documentType: InvoiceDocumentType.E_ARCHIVE,
      externalDocumentId: null,
      invoiceNumber: null,
      uuid: null,
      currency: 'TRY',
      subtotal: baseSale.subtotal,
      taxAmount: baseSale.taxAmount,
      totalAmount: baseSale.totalAmount,
      errorCode: 'X',
      errorMessage: 'fail',
    });
    prisma.invoice.update
      .mockResolvedValueOnce({
        id: 'inv1',
        saleId,
        status: InvoiceStatus.PENDING,
        provider: 'KOLAYBI',
        documentType: InvoiceDocumentType.E_ARCHIVE,
        externalDocumentId: null,
        invoiceNumber: null,
        uuid: null,
        currency: 'TRY',
        subtotal: baseSale.subtotal,
        taxAmount: baseSale.taxAmount,
        totalAmount: baseSale.totalAmount,
        errorCode: null,
        errorMessage: null,
      })
      .mockResolvedValueOnce({
        id: 'inv1',
        saleId,
        status: InvoiceStatus.SUCCESS,
        provider: 'KOLAYBI',
        documentType: InvoiceDocumentType.E_ARCHIVE,
        externalDocumentId: '1854',
        invoiceNumber: 'S20260918-0001',
        uuid: null,
        currency: 'TRY',
        subtotal: baseSale.subtotal,
        taxAmount: baseSale.taxAmount,
        totalAmount: baseSale.totalAmount,
        errorCode: null,
        errorMessage: null,
      });

    const result = await service.createFromSale(saleId, adminId, {});
    expect(result.status).toBe(InvoiceStatus.SUCCESS);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(createInvoice).toHaveBeenCalled();
  });

  it('marks FAILED on KolayBi 400', async () => {
    createInvoice.mockRejectedValue(
      new KolayBiApiError('bad', 400, 'KOLAYBI_VALIDATION_ERROR', false),
    );
    await expect(
      service.createFromSale(saleId, adminId, {}),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: InvoiceStatus.FAILED,
          errorCode: 'KOLAYBI_VALIDATION_ERROR',
        }),
      }),
    );
  });

  it('keeps PENDING on retryable timeout', async () => {
    createInvoice.mockRejectedValue(
      new KolayBiApiError('timeout', 504, 'KOLAYBI_TIMEOUT', true),
    );
    await expect(
      service.createFromSale(saleId, adminId, {}),
    ).rejects.toMatchObject({
      code: 'KOLAYBI_TIMEOUT',
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: InvoiceStatus.PENDING,
          errorCode: 'KOLAYBI_TIMEOUT',
        }),
      }),
    );
  });

  it('fails on total mismatch after create', async () => {
    createInvoice.mockResolvedValue({
      provider: 'KOLAYBI',
      externalDocumentId: '1854',
      invoiceNumber: 'S20260918-0001',
      uuid: null,
      grandTotal: '999.00',
      created: true,
      resolvedExisting: false,
    });
    await expect(
      service.createFromSale(saleId, adminId, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses SaleItem exclusive price not product price', async () => {
    await service.createFromSale(saleId, adminId, {});
    const arg = createInvoice.mock.calls[0][0] as {
      lines: Array<{ unitPriceExclusive: string }>;
    };
    expect(arg.lines[0]?.unitPriceExclusive).toBe('100.00');
  });

  it('handles concurrent create via P2002 then returns raced SUCCESS', async () => {
    prisma.invoice.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.invoice.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'inv-race',
        saleId,
        status: InvoiceStatus.SUCCESS,
        provider: 'KOLAYBI',
        documentType: InvoiceDocumentType.E_ARCHIVE,
        externalDocumentId: '99',
        invoiceNumber: 'S20260918-0001',
        uuid: null,
        currency: 'TRY',
        subtotal: baseSale.subtotal,
        taxAmount: baseSale.taxAmount,
        totalAmount: baseSale.totalAmount,
        errorCode: null,
        errorMessage: null,
        issuedAt: new Date(),
      });

    const result = await service.createFromSale(saleId, adminId, {});
    expect(result.status).toBe(InvoiceStatus.SUCCESS);
    expect(result.externalDocumentId).toBe('99');
    expect(createInvoice).not.toHaveBeenCalled();
  });
});

describe('invoice helpers', () => {
  it('formats business date', () => {
    expect(
      formatBusinessDate(new Date('2026-09-18T10:00:00Z'), 'Europe/Istanbul'),
    ).toBe('2026-09-18');
  });

  it('matches totals within 0.01', () => {
    expect(totalsMatch('120.00', '120.00')).toBe(true);
    expect(totalsMatch('120.01', '120.00')).toBe(true);
    expect(totalsMatch('120.02', '120.00')).toBe(false);
  });
});
