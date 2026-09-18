import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KolayBiApiError } from './clients/kolaybi.errors';
import {
  InvoiceSyncResponseDto,
  toSyncDisplayStatus,
} from './dto/invoice-document.dto';
import { saleInvoiceIdempotencyKey } from './invoice-from-sale.service';
import { InvoicesService } from './invoices.service';
import { KOLAYBI_INVOICE_PROVIDER } from './providers/invoice-provider.interface';
import type {
  ProviderDocumentOutputType,
  ProviderDocumentResult,
} from './providers/provider-customer.types';

export type InvoiceDocumentDownload = ProviderDocumentResult & {
  filename: string;
  invoiceId: string;
};

/**
 * Phase 8 — retrieve PDF/XML via provider + sync remote uuid/serial.
 * Does not touch Sale / stock / payment.
 * Does not persist to R2 in this phase (pdfUrl/xmlUrl remain for future).
 */
@Injectable()
export class InvoiceDocumentService {
  private readonly logger = new Logger(InvoiceDocumentService.name);

  constructor(
    private readonly invoices: InvoicesService,
    private readonly prisma: PrismaService,
  ) {}

  async getDocument(
    invoiceId: string,
    outputType: ProviderDocumentOutputType,
  ): Promise<InvoiceDocumentDownload> {
    const provider = this.invoices.resolveProvider(KOLAYBI_INVOICE_PROVIDER);
    this.invoices.assertProviderEnabledPublic(provider);

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException('Fatura bulunamadı');
    }
    if (invoice.provider !== 'KOLAYBI') {
      throw new BadRequestException(
        `Belge indirme yalnızca KOLAYBI için desteklenir (şu an: ${String(invoice.provider)})`,
      );
    }
    if (!invoice.uuid?.trim()) {
      throw new BadRequestException(
        'PDF/XML için fatura resmileştirilmiş olmalı (uuid/ETTN gerekli)',
      );
    }

    try {
      const doc = await provider.getInvoiceDocument({
        uuid: invoice.uuid.trim(),
        outputType,
        direction: 'outbound',
      });

      const base =
        invoice.invoiceNumber?.replace(/[^\w.-]+/g, '_') ||
        invoice.id.slice(0, 8);
      const ext = outputType === 'xml' ? 'xml' : 'pdf';

      return {
        ...doc,
        invoiceId: invoice.id,
        filename: `invoice-${base}.${ext}`,
      };
    } catch (err) {
      throw this.invoices.toHttpExceptionPublic(err);
    }
  }

  /**
   * Refresh uuid / invoiceNumber from KolayBi detail + list.
   * Concurrent-safe: never overwrite an existing different uuid;
   * writing the same values twice is a no-op.
   */
  async syncFromProvider(invoiceId: string): Promise<InvoiceSyncResponseDto> {
    const provider = this.invoices.resolveProvider(KOLAYBI_INVOICE_PROVIDER);
    this.invoices.assertProviderEnabledPublic(provider);

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException('Fatura bulunamadı');
    }
    if (invoice.provider !== 'KOLAYBI') {
      throw new BadRequestException(
        `Sync yalnızca KOLAYBI için desteklenir (şu an: ${String(invoice.provider)})`,
      );
    }
    if (!invoice.externalDocumentId?.trim()) {
      throw new BadRequestException(
        'Sync için KolayBi document_id (externalDocumentId) gerekli',
      );
    }

    let remote;
    try {
      remote = await provider.getInvoiceRemoteState({
        externalDocumentId: invoice.externalDocumentId.trim(),
        description: saleInvoiceIdempotencyKey(invoice.saleId),
      });
    } catch (err) {
      if (err instanceof KolayBiApiError) {
        this.logger.warn(
          JSON.stringify({
            event: 'invoice_sync_failed',
            invoiceId,
            code: err.code,
          }),
        );
      }
      throw this.invoices.toHttpExceptionPublic(err);
    }

    const nextUuid = remote.uuid?.trim() || null;
    const nextNumber = remote.invoiceNumber?.trim() || null;
    const localUuid = invoice.uuid?.trim() || null;
    const localNumber = invoice.invoiceNumber?.trim() || null;

    const data: {
      uuid?: string;
      invoiceNumber?: string;
      errorCode?: null;
      errorMessage?: null;
      issuedAt?: Date;
    } = {};

    // Fill uuid only when local is empty (never clobber a different ETTN)
    if (nextUuid && !localUuid) {
      data.uuid = nextUuid;
      if (!invoice.issuedAt) {
        data.issuedAt = new Date();
      }
    }

    if (nextNumber && nextNumber !== localNumber) {
      data.invoiceNumber = nextNumber;
    }

    if ((data.uuid || localUuid) && invoice.errorCode === 'FORMALIZE_UNKNOWN') {
      data.errorCode = null;
      data.errorMessage = null;
    }

    let current = invoice;
    let updated = false;

    if (Object.keys(data).length > 0) {
      current = await this.prisma.invoice.update({
        where: { id: invoiceId },
        data,
      });
      updated = true;
    }

    this.logger.log(
      JSON.stringify({
        event: 'invoice_sync',
        invoiceId,
        saleId: invoice.saleId,
        provider: invoice.provider,
        operation: 'sync_from_provider',
        updated,
        hasUuid: Boolean(current.uuid),
      }),
    );

    return {
      invoiceId: current.id,
      status: current.status,
      displayStatus: toSyncDisplayStatus(current.status, current.uuid),
      uuid: current.uuid,
      invoiceNumber: current.invoiceNumber,
      externalDocumentId: current.externalDocumentId,
      providerEDocumentStatus: remote.providerEDocumentStatus,
      providerCommercialStatus: remote.providerCommercialStatus,
      updated,
    };
  }
}
