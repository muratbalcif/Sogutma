/* eslint-disable @typescript-eslint/no-unsafe-assignment -- jest asymmetric matchers */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceDocumentType, InvoiceStatus } from '@prisma/client';
import { KolayBiApiError } from './clients/kolaybi.errors';
import { InvoiceFormalizeService } from './invoice-formalize.service';
import { InvoicesService } from './invoices.service';
import type { InvoiceProvider } from './providers/invoice-provider.interface';

describe('InvoiceFormalizeService', () => {
  const formalizeInvoice = jest.fn();
  const provider: InvoiceProvider = {
    code: 'KOLAYBI',
    enabled: true,
    authenticate: jest.fn(),
    healthCheck: jest.fn(),
    ensureCustomer: jest.fn(),
    ensureAddress: jest.fn(),
    ensureProduct: jest.fn(),
    createInvoice: jest.fn(),
    formalizeInvoice,
  };

  const invoices = {
    resolveProvider: jest.fn().mockReturnValue(provider),
    assertProviderEnabledPublic: jest.fn(),
    toHttpExceptionPublic: jest.fn((err: unknown) => err),
  };

  const prisma = {
    invoice: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const service = new InvoiceFormalizeService(
    invoices as unknown as InvoicesService,
    prisma as never,
  );

  const invoiceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const adminId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const baseInvoice = {
    id: invoiceId,
    saleId: 'sale1',
    status: InvoiceStatus.SUCCESS,
    provider: 'KOLAYBI',
    documentType: InvoiceDocumentType.E_ARCHIVE,
    externalDocumentId: '1854',
    uuid: null as string | null,
    invoiceNumber: 'S20260918-0001',
    errorCode: null as string | null,
    errorMessage: null as string | null,
    issuedAt: new Date(),
    customer: {
      id: 'cust1',
      isEInvoiceTaxpayer: false,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    invoices.resolveProvider.mockReturnValue(provider);
    invoices.assertProviderEnabledPublic.mockImplementation(() => undefined);
    invoices.toHttpExceptionPublic.mockImplementation((err: unknown) => err);
    prisma.invoice.findUnique.mockResolvedValue({ ...baseInvoice });
    prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
    prisma.invoice.findUniqueOrThrow.mockResolvedValue({
      ...baseInvoice,
      uuid: 'f46d5a8d-7726-4b37-bba4-973c7ab50a5b',
      invoiceNumber: 'HDB2021000008464',
      errorCode: null,
      errorMessage: null,
    });
    formalizeInvoice.mockResolvedValue({
      provider: 'KOLAYBI',
      externalDocumentId: '1854',
      uuid: 'f46d5a8d-7726-4b37-bba4-973c7ab50a5b',
      invoiceNumber: 'HDB2021000008464',
      providerStatus: 'sent_to_receiver',
      providerScenario: 'EARSIVFATURA',
      resolvedExisting: false,
    });
  });

  it('formalizes e-Arşiv draft and stores uuid + invoice number', async () => {
    const result = await service.formalize(invoiceId, adminId, {});
    expect(result.uuid).toBe('f46d5a8d-7726-4b37-bba4-973c7ab50a5b');
    expect(result.invoiceNumber).toBe('HDB2021000008464');
    expect(result.providerScenario).toBe('EARSIVFATURA');
    expect(result.alreadyFormalized).toBe(false);
    expect(formalizeInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        externalDocumentId: '1854',
        localInvoiceId: invoiceId,
      }),
    );
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: invoiceId, uuid: null },
        data: expect.objectContaining({
          uuid: 'f46d5a8d-7726-4b37-bba4-973c7ab50a5b',
          invoiceNumber: 'HDB2021000008464',
        }),
      }),
    );
  });

  it('formalizes e-Fatura taxpayer invoice', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      ...baseInvoice,
      documentType: InvoiceDocumentType.E_INVOICE,
      customer: { id: 'cust1', isEInvoiceTaxpayer: true },
    });
    formalizeInvoice.mockResolvedValue({
      provider: 'KOLAYBI',
      externalDocumentId: '1854',
      uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      invoiceNumber: 'ABC2026000001',
      providerStatus: 'sent_to_receiver',
      providerScenario: 'TICARIFATURA',
      resolvedExisting: false,
    });
    prisma.invoice.findUniqueOrThrow.mockResolvedValue({
      ...baseInvoice,
      documentType: InvoiceDocumentType.E_INVOICE,
      uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      invoiceNumber: 'ABC2026000001',
    });

    const result = await service.formalize(invoiceId, adminId, {});
    expect(result.documentType).toBe(InvoiceDocumentType.E_INVOICE);
    expect(result.uuid).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  });

  it('returns existing formalized invoice without calling provider', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      ...baseInvoice,
      uuid: 'already-uuid',
      invoiceNumber: 'HDB1',
    });
    const result = await service.formalize(invoiceId, adminId, {});
    expect(result.alreadyFormalized).toBe(true);
    expect(result.uuid).toBe('already-uuid');
    expect(formalizeInvoice).not.toHaveBeenCalled();
  });

  it('rejects missing invoice', async () => {
    prisma.invoice.findUnique.mockResolvedValue(null);
    await expect(
      service.formalize(invoiceId, adminId, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects PENDING invoice (draft not ready)', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      ...baseInvoice,
      status: InvoiceStatus.PENDING,
    });
    await expect(service.formalize(invoiceId, adminId, {})).rejects.toThrow(
      /SUCCESS/i,
    );
  });

  it('rejects missing externalDocumentId', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      ...baseInvoice,
      externalDocumentId: null,
    });
    await expect(service.formalize(invoiceId, adminId, {})).rejects.toThrow(
      /document_id/i,
    );
  });

  it('rejects taxpayer / documentType mismatch', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      ...baseInvoice,
      documentType: InvoiceDocumentType.E_INVOICE,
      customer: { id: 'cust1', isEInvoiceTaxpayer: false },
    });
    await expect(service.formalize(invoiceId, adminId, {})).rejects.toThrow(
      /mükellefiyet/i,
    );
    expect(formalizeInvoice).not.toHaveBeenCalled();
  });

  it('rejects when provider disabled', async () => {
    invoices.assertProviderEnabledPublic.mockImplementation(() => {
      throw new BadRequestException('disabled');
    });
    await expect(
      service.formalize(invoiceId, adminId, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps SUCCESS and sets FORMALIZE_UNKNOWN on timeout', async () => {
    formalizeInvoice.mockRejectedValue(
      new KolayBiApiError('timeout', 504, 'KOLAYBI_TIMEOUT', true),
    );
    await expect(
      service.formalize(invoiceId, adminId, {}),
    ).rejects.toMatchObject({
      code: 'KOLAYBI_TIMEOUT',
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorCode: 'FORMALIZE_UNKNOWN',
        }),
      }),
    );
  });

  it('stores error on 400 without inventing uuid', async () => {
    formalizeInvoice.mockRejectedValue(
      new KolayBiApiError('bad', 400, 'KOLAYBI_VALIDATION_ERROR', false),
    );
    await expect(
      service.formalize(invoiceId, adminId, {}),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorCode: 'KOLAYBI_VALIDATION_ERROR',
        }),
      }),
    );
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
  });

  it('handles concurrent formalize when uuid already written', async () => {
    prisma.invoice.updateMany.mockResolvedValue({ count: 0 });
    prisma.invoice.findUnique
      .mockResolvedValueOnce({ ...baseInvoice })
      .mockResolvedValueOnce({
        ...baseInvoice,
        uuid: 'race-uuid',
        invoiceNumber: 'RACE1',
      });

    const result = await service.formalize(invoiceId, adminId, {});
    expect(result.uuid).toBe('race-uuid');
    expect(result.alreadyFormalized).toBe(true);
  });

  it('does not invent uuid when provider omits it', async () => {
    formalizeInvoice.mockRejectedValue(
      new KolayBiApiError(
        'KolayBi e-document create response missing uuid',
        502,
        'KOLAYBI_INVALID_RESPONSE',
        true,
      ),
    );
    await expect(
      service.formalize(invoiceId, adminId, {}),
    ).rejects.toMatchObject({
      code: 'KOLAYBI_INVALID_RESPONSE',
    });
  });
});
