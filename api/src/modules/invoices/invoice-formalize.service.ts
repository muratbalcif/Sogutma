import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceDocumentType, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KolayBiApiError } from './clients/kolaybi.errors';
import {
  FormalizeInvoiceDto,
  FormalizeInvoiceResponseDto,
} from './dto/formalize-invoice.dto';
import { InvoicesService } from './invoices.service';
import { KOLAYBI_INVOICE_PROVIDER } from './providers/invoice-provider.interface';

/**
 * Formalize KolayBi draft invoice → e-Fatura / e-Arşiv.
 *
 * Lifecycle (no migration — Phase 1 enums):
 * - SUCCESS + uuid null  → draft ready to formalize
 * - SUCCESS + uuid set   → formalized (ETTN present)
 * - Timeout / unknown    → stay SUCCESS + uuid null; errorCode = FORMALIZE_UNKNOWN
 *
 * Does not touch Sale / stock / payment.
 */
@Injectable()
export class InvoiceFormalizeService {
  private readonly logger = new Logger(InvoiceFormalizeService.name);

  constructor(
    private readonly invoices: InvoicesService,
    private readonly prisma: PrismaService,
  ) {}

  async formalize(
    invoiceId: string,
    _adminUserId: string,
    dto: FormalizeInvoiceDto = {},
  ): Promise<FormalizeInvoiceResponseDto> {
    const provider = this.invoices.resolveProvider(KOLAYBI_INVOICE_PROVIDER);
    this.invoices.assertProviderEnabledPublic(provider);

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: {
          select: {
            id: true,
            isEInvoiceTaxpayer: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura bulunamadı');
    }

    if (invoice.provider !== 'KOLAYBI') {
      throw new BadRequestException(
        `Formalize yalnızca KOLAYBI provider için desteklenir (şu an: ${String(invoice.provider)})`,
      );
    }

    // Already formalized — idempotent return
    if (invoice.uuid?.trim()) {
      return this.toResponse(invoice, {
        alreadyFormalized: true,
        providerScenario: null,
      });
    }

    if (invoice.status !== InvoiceStatus.SUCCESS) {
      throw new BadRequestException(
        'Formalize için fatura SUCCESS (KolayBi draft) durumunda olmalı',
      );
    }

    if (!invoice.externalDocumentId?.trim()) {
      throw new BadRequestException(
        'Formalize için KolayBi document_id (externalDocumentId) gerekli',
      );
    }

    const expectedType = invoice.customer.isEInvoiceTaxpayer
      ? InvoiceDocumentType.E_INVOICE
      : InvoiceDocumentType.E_ARCHIVE;

    if (invoice.documentType !== expectedType) {
      throw new BadRequestException(
        `Fatura belge tipi müşteri mükellefiyeti ile uyuşmuyor (beklenen: ${expectedType}, mevcut: ${invoice.documentType}). Local isEInvoiceTaxpayer GİB sorgusu değildir.`,
      );
    }

    try {
      const result = await provider.formalizeInvoice({
        localInvoiceId: invoice.id,
        externalDocumentId: invoice.externalDocumentId,
        prefix: dto.prefix ?? null,
      });

      if (result.providerScenario) {
        this.warnScenarioMismatch(
          invoice.documentType,
          result.providerScenario,
          invoice.id,
        );
      }

      // Conditional update: only write if still unformalized (concurrent-safe).
      const claimed = await this.prisma.invoice.updateMany({
        where: {
          id: invoice.id,
          uuid: null,
        },
        data: {
          uuid: result.uuid,
          invoiceNumber: result.invoiceNumber ?? invoice.invoiceNumber,
          errorCode: null,
          errorMessage: null,
          issuedAt: invoice.issuedAt ?? new Date(),
        },
      });

      if (claimed.count === 0) {
        const refreshed = await this.prisma.invoice.findUnique({
          where: { id: invoice.id },
        });
        if (refreshed?.uuid?.trim()) {
          return this.toResponse(refreshed, {
            alreadyFormalized: true,
            providerScenario: result.providerScenario,
          });
        }
      }

      const updated = await this.prisma.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
      });

      return this.toResponse(updated, {
        alreadyFormalized: result.resolvedExisting || claimed.count === 0,
        providerScenario: result.providerScenario,
      });
    } catch (err) {
      if (err instanceof KolayBiApiError && err.retryable) {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            errorCode: 'FORMALIZE_UNKNOWN',
            errorMessage: err.message.slice(0, 500),
          },
        });
        throw this.invoices.toHttpExceptionPublic(err);
      }

      const code =
        err instanceof KolayBiApiError ? err.code : 'FORMALIZE_FAILED';
      const message =
        err instanceof KolayBiApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Formalize failed';

      this.logger.warn(
        JSON.stringify({
          event: 'formalize_failed',
          invoiceId: invoice.id,
          code,
        }),
      );

      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          errorCode: code,
          errorMessage: message.slice(0, 500),
        },
      });

      throw this.invoices.toHttpExceptionPublic(err);
    }
  }

  /**
   * Soft check only — KolayBi chooses scenario; we do not send it.
   * Known documented example: EARSIVFATURA.
   */
  private warnScenarioMismatch(
    documentType: InvoiceDocumentType,
    scenario: string,
    invoiceId: string,
  ): void {
    const upper = scenario.toUpperCase();
    const looksArchive = upper.includes('EARSIV');
    const expectsArchive = documentType === InvoiceDocumentType.E_ARCHIVE;
    if (looksArchive !== expectsArchive) {
      this.logger.warn(
        JSON.stringify({
          event: 'formalize_scenario_mismatch',
          invoiceId,
          documentType,
          providerScenario: scenario,
        }),
      );
    }
  }

  private toResponse(
    invoice: {
      id: string;
      saleId: string;
      status: InvoiceStatus;
      documentType: InvoiceDocumentType;
      provider: string;
      externalDocumentId: string | null;
      uuid: string | null;
      invoiceNumber: string | null;
      errorCode: string | null;
      errorMessage: string | null;
    },
    extra: {
      alreadyFormalized: boolean;
      providerScenario: string | null;
    },
  ): FormalizeInvoiceResponseDto {
    if (!invoice.uuid?.trim()) {
      throw new BadRequestException('Formalize sonucu uuid eksik');
    }
    return {
      invoiceId: invoice.id,
      saleId: invoice.saleId,
      status: invoice.status,
      documentType: invoice.documentType,
      provider: invoice.provider,
      externalDocumentId: invoice.externalDocumentId,
      uuid: invoice.uuid,
      invoiceNumber: invoice.invoiceNumber,
      providerScenario: extra.providerScenario,
      errorCode: invoice.errorCode,
      errorMessage: invoice.errorMessage,
      alreadyFormalized: extra.alreadyFormalized,
    };
  }
}
