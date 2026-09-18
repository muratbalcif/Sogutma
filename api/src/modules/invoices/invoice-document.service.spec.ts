/* eslint-disable @typescript-eslint/no-unsafe-assignment -- jest asymmetric matchers */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { KolayBiApiError } from './clients/kolaybi.errors';
import { InvoiceDocumentService } from './invoice-document.service';
import { InvoicesService } from './invoices.service';
import type { InvoiceProvider } from './providers/invoice-provider.interface';

describe('InvoiceDocumentService', () => {
  const getInvoiceDocument = jest.fn();
  const getInvoiceRemoteState = jest.fn();
  const provider: InvoiceProvider = {
    code: 'KOLAYBI',
    enabled: true,
    authenticate: jest.fn(),
    healthCheck: jest.fn(),
    ensureCustomer: jest.fn(),
    ensureAddress: jest.fn(),
    ensureProduct: jest.fn(),
    createInvoice: jest.fn(),
    formalizeInvoice: jest.fn(),
    getInvoiceDocument,
    getInvoiceRemoteState,
  };

  const invoices = {
    resolveProvider: jest.fn().mockReturnValue(provider),
    assertProviderEnabledPublic: jest.fn(),
    toHttpExceptionPublic: jest.fn((err: unknown) => err),
  };

  const prisma = {
    invoice: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const service = new InvoiceDocumentService(
    invoices as unknown as InvoicesService,
    prisma as never,
  );

  const invoiceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const saleId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeEach(() => {
    jest.clearAllMocks();
    invoices.resolveProvider.mockReturnValue(provider);
  });

  describe('getDocument', () => {
    it('returns decoded PDF bytes', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        provider: 'KOLAYBI',
        uuid: 'ettn-1',
        invoiceNumber: 'HDB1',
        status: InvoiceStatus.SUCCESS,
      });
      getInvoiceDocument.mockResolvedValue({
        provider: 'KOLAYBI',
        outputType: 'pdf',
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.4'),
      });

      const result = await service.getDocument(invoiceId, 'pdf');
      expect(result.contentType).toBe('application/pdf');
      expect(result.body.toString()).toContain('%PDF');
      expect(result.filename).toContain('HDB1');
      expect(getInvoiceDocument).toHaveBeenCalledWith(
        expect.objectContaining({ uuid: 'ettn-1', outputType: 'pdf' }),
      );
    });

    it('returns XML when requested', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        provider: 'KOLAYBI',
        uuid: 'ettn-1',
        invoiceNumber: null,
        status: InvoiceStatus.SUCCESS,
      });
      getInvoiceDocument.mockResolvedValue({
        provider: 'KOLAYBI',
        outputType: 'xml',
        contentType: 'application/xml',
        body: Buffer.from('<Invoice/>'),
      });

      const result = await service.getDocument(invoiceId, 'xml');
      expect(result.contentType).toBe('application/xml');
      expect(result.filename.endsWith('.xml')).toBe(true);
    });

    it('rejects when uuid missing (draft)', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        provider: 'KOLAYBI',
        uuid: null,
        status: InvoiceStatus.SUCCESS,
      });
      await expect(
        service.getDocument(invoiceId, 'pdf'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(getInvoiceDocument).not.toHaveBeenCalled();
    });

    it('throws not found', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);
      await expect(
        service.getDocument(invoiceId, 'pdf'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps provider 404', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        provider: 'KOLAYBI',
        uuid: 'ettn-1',
        invoiceNumber: 'X',
        status: InvoiceStatus.SUCCESS,
      });
      getInvoiceDocument.mockRejectedValue(
        new KolayBiApiError('missing', 404, 'KOLAYBI_NOT_FOUND', false),
      );
      await expect(
        service.getDocument(invoiceId, 'pdf'),
      ).rejects.toBeInstanceOf(KolayBiApiError);
    });

    it('maps provider 401', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        provider: 'KOLAYBI',
        uuid: 'ettn-1',
        invoiceNumber: 'X',
        status: InvoiceStatus.SUCCESS,
      });
      getInvoiceDocument.mockRejectedValue(
        new KolayBiApiError('unauth', 401, 'KOLAYBI_UNAUTHORIZED', false),
      );
      await expect(service.getDocument(invoiceId, 'pdf')).rejects.toMatchObject(
        {
          code: 'KOLAYBI_UNAUTHORIZED',
        },
      );
    });

    it('maps provider 429 as retryable path', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        provider: 'KOLAYBI',
        uuid: 'ettn-1',
        invoiceNumber: 'X',
        status: InvoiceStatus.SUCCESS,
      });
      getInvoiceDocument.mockRejectedValue(
        new KolayBiApiError('rate', 429, 'KOLAYBI_RATE_LIMITED', true),
      );
      await expect(service.getDocument(invoiceId, 'pdf')).rejects.toMatchObject(
        {
          code: 'KOLAYBI_RATE_LIMITED',
          retryable: true,
        },
      );
    });

    it('maps provider 500', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        provider: 'KOLAYBI',
        uuid: 'ettn-1',
        invoiceNumber: 'X',
        status: InvoiceStatus.SUCCESS,
      });
      getInvoiceDocument.mockRejectedValue(
        new KolayBiApiError('up', 503, 'KOLAYBI_UPSTREAM_ERROR', true),
      );
      await expect(service.getDocument(invoiceId, 'pdf')).rejects.toMatchObject(
        {
          code: 'KOLAYBI_UPSTREAM_ERROR',
        },
      );
    });

    it('maps timeout', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        provider: 'KOLAYBI',
        uuid: 'ettn-1',
        invoiceNumber: 'X',
        status: InvoiceStatus.SUCCESS,
      });
      getInvoiceDocument.mockRejectedValue(
        new KolayBiApiError('timeout', 504, 'KOLAYBI_TIMEOUT', true),
      );
      await expect(service.getDocument(invoiceId, 'pdf')).rejects.toMatchObject(
        {
          code: 'KOLAYBI_TIMEOUT',
        },
      );
    });
  });

  describe('syncFromProvider', () => {
    it('fills uuid and invoice number from remote', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        saleId,
        provider: 'KOLAYBI',
        status: InvoiceStatus.SUCCESS,
        externalDocumentId: '18',
        uuid: null,
        invoiceNumber: null,
        errorCode: null,
        issuedAt: null,
      });
      getInvoiceRemoteState.mockResolvedValue({
        provider: 'KOLAYBI',
        externalDocumentId: '18',
        uuid: 'new-ettn',
        invoiceNumber: 'HDB99',
        providerEDocumentStatus: 'sent_to_receiver',
        providerCommercialStatus: 'sent',
      });
      prisma.invoice.update.mockResolvedValue({
        id: invoiceId,
        status: InvoiceStatus.SUCCESS,
        uuid: 'new-ettn',
        invoiceNumber: 'HDB99',
        externalDocumentId: '18',
      });

      const result = await service.syncFromProvider(invoiceId);
      expect(result.updated).toBe(true);
      expect(result.uuid).toBe('new-ettn');
      expect(result.invoiceNumber).toBe('HDB99');
      expect(result.displayStatus).toBe('FORMALIZED');
      expect(result.providerEDocumentStatus).toBe('sent_to_receiver');
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            uuid: 'new-ettn',
            invoiceNumber: 'HDB99',
          }),
        }),
      );
    });

    it('duplicate sync with same values is no-op', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        saleId,
        provider: 'KOLAYBI',
        status: InvoiceStatus.SUCCESS,
        externalDocumentId: '18',
        uuid: 'ettn',
        invoiceNumber: 'HDB1',
        errorCode: null,
        issuedAt: new Date(),
      });
      getInvoiceRemoteState.mockResolvedValue({
        provider: 'KOLAYBI',
        externalDocumentId: '18',
        uuid: 'ettn',
        invoiceNumber: 'HDB1',
        providerEDocumentStatus: 'sent_to_receiver',
        providerCommercialStatus: 'sent',
      });

      const result = await service.syncFromProvider(invoiceId);
      expect(result.updated).toBe(false);
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('does not overwrite existing different uuid', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        saleId,
        provider: 'KOLAYBI',
        status: InvoiceStatus.SUCCESS,
        externalDocumentId: '18',
        uuid: 'local-ettn',
        invoiceNumber: 'HDB1',
        errorCode: null,
        issuedAt: new Date(),
      });
      getInvoiceRemoteState.mockResolvedValue({
        provider: 'KOLAYBI',
        externalDocumentId: '18',
        uuid: 'other-ettn',
        invoiceNumber: 'HDB1',
        providerEDocumentStatus: null,
        providerCommercialStatus: null,
      });

      const result = await service.syncFromProvider(invoiceId);
      expect(result.updated).toBe(false);
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('clears FORMALIZE_UNKNOWN when uuid recovered', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        saleId,
        provider: 'KOLAYBI',
        status: InvoiceStatus.SUCCESS,
        externalDocumentId: '18',
        uuid: null,
        invoiceNumber: null,
        errorCode: 'FORMALIZE_UNKNOWN',
        errorMessage: 'timeout',
        issuedAt: null,
      });
      getInvoiceRemoteState.mockResolvedValue({
        provider: 'KOLAYBI',
        externalDocumentId: '18',
        uuid: 'recovered',
        invoiceNumber: null,
        providerEDocumentStatus: null,
        providerCommercialStatus: null,
      });
      prisma.invoice.update.mockResolvedValue({
        id: invoiceId,
        status: InvoiceStatus.SUCCESS,
        uuid: 'recovered',
        invoiceNumber: null,
        externalDocumentId: '18',
      });

      await service.syncFromProvider(invoiceId);
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            uuid: 'recovered',
            errorCode: null,
            errorMessage: null,
          }),
        }),
      );
    });

    it('rejects sync without externalDocumentId', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        saleId,
        provider: 'KOLAYBI',
        externalDocumentId: null,
      });
      await expect(service.syncFromProvider(invoiceId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
