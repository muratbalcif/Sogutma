import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvoiceDocumentType,
  InvoiceStatus,
  Prisma,
  SaleStatus,
} from '@prisma/client';
import { toMoneyString } from '../../common/utils/money.util';
import { EnvironmentVariables } from '../../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { KolayBiApiError } from './clients/kolaybi.errors';
import {
  CreateInvoiceFromSaleDto,
  InvoiceFromSaleResponseDto,
} from './dto/create-invoice-from-sale.dto';
import { InvoicesService } from './invoices.service';
import { KOLAYBI_INVOICE_PROVIDER } from './providers/invoice-provider.interface';
import type { ProviderInvoiceInput } from './providers/provider-customer.types';

export function saleInvoiceIdempotencyKey(saleId: string): string {
  return `SALE:${saleId}`;
}

export function saleInvoiceDescription(saleId: string): string {
  return `SALE:${saleId}`;
}

/**
 * Sale → local Invoice PENDING → KolayBi draft invoice.
 * Does not formalize e-documents (Phase 6). Does not touch stock/payment/Sale.
 */
@Injectable()
export class InvoiceFromSaleService {
  private readonly logger = new Logger(InvoiceFromSaleService.name);

  constructor(
    private readonly invoices: InvoicesService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async createFromSale(
    saleId: string,
    adminUserId: string,
    dto: CreateInvoiceFromSaleDto = {},
  ): Promise<InvoiceFromSaleResponseDto> {
    const provider = this.invoices.resolveProvider(KOLAYBI_INVOICE_PROVIDER);
    this.invoices.assertProviderEnabledPublic(provider);

    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        customer: {
          include: { corporateCustomer: true },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Satış bulunamadı');
    }
    if (sale.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException(
        'Fatura yalnızca tamamlanmış (COMPLETED) satışlar için oluşturulabilir',
      );
    }
    if (!sale.customerId || !sale.customer) {
      throw new BadRequestException(
        'Fatura oluşturmak için müşteri bilgisi gereklidir.',
      );
    }
    if (!sale.items.length) {
      throw new BadRequestException('Satışta faturalanacak kalem yok');
    }
    for (const item of sale.items) {
      if (!item.productId) {
        throw new BadRequestException(
          `Satış kalemi ürün bağlantısı eksik: ${item.sku}`,
        );
      }
    }

    const idempotencyKey = saleInvoiceIdempotencyKey(saleId);
    const existing = await this.prisma.invoice.findUnique({
      where: { idempotencyKey },
    });

    if (existing?.status === InvoiceStatus.SUCCESS) {
      return this.toResponse(existing);
    }
    if (
      existing?.status === InvoiceStatus.PENDING &&
      existing.externalDocumentId
    ) {
      // Provider create succeeded earlier; finalize local SUCCESS.
      const finalized = await this.prisma.invoice.update({
        where: { id: existing.id },
        data: {
          status: InvoiceStatus.SUCCESS,
          errorCode: null,
          errorMessage: null,
          issuedAt: existing.issuedAt ?? new Date(),
        },
      });
      return this.toResponse(finalized);
    }

    const address = await this.resolveBillingAddress(
      sale.customerId,
      dto.billingAddressId,
    );

    const documentType = this.resolveDocumentType(
      sale.customer.isEInvoiceTaxpayer,
      dto.documentType,
    );

    const snapshot = {
      title: address.title,
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
      city: address.city,
      district: address.district,
      neighborhood: address.neighborhood,
      addressLine: address.addressLine,
      postalCode: address.postalCode,
      country: address.country,
      companyName: sale.customer.corporateCustomer?.companyName ?? null,
    };

    let invoice =
      existing ??
      (await this.createPendingInvoice({
        saleId,
        customerId: sale.customerId,
        createdById: adminUserId,
        documentType,
        idempotencyKey,
        currency: sale.currency,
        subtotal: sale.subtotal,
        discountAmount: sale.discountAmount,
        taxAmount: sale.taxAmount,
        totalAmount: sale.totalAmount,
        billingAddressId: address.id,
        billingAddressSnapshot: snapshot,
      }));

    if (invoice.status === InvoiceStatus.SUCCESS) {
      return this.toResponse(invoice);
    }

    if (
      invoice.status === InvoiceStatus.PENDING &&
      invoice.externalDocumentId
    ) {
      const finalized = await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.SUCCESS,
          errorCode: null,
          errorMessage: null,
          issuedAt: invoice.issuedAt ?? new Date(),
        },
      });
      return this.toResponse(finalized);
    }

    if (
      invoice.status === InvoiceStatus.FAILED ||
      invoice.status === InvoiceStatus.CANCELLED
    ) {
      invoice = await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.PENDING,
          documentType,
          billingAddressId: address.id,
          billingAddressSnapshot: snapshot,
          errorCode: null,
          errorMessage: null,
          externalDocumentId: null,
          invoiceNumber: null,
          uuid: null,
          issuedAt: null,
        },
      });
    }

    // Sync entities OUTSIDE a DB transaction (HTTP must not hold Prisma tx).
    let customerSync;
    let addressSync;
    try {
      customerSync = await this.invoices.syncCustomer(sale.customerId);
      addressSync = await this.invoices.syncAddress(address.id);
    } catch (err) {
      await this.markFailed(invoice.id, err);
      throw this.invoices.toHttpExceptionPublic(err);
    }

    const lineInputs: ProviderInvoiceInput['lines'] = [];
    try {
      for (const item of sale.items) {
        const productSync = await this.invoices.syncProduct(item.productId!);
        const qty = item.quantity;
        const exclusiveUnit = new Prisma.Decimal(item.lineSubtotal)
          .div(qty)
          .toDecimalPlaces(2);
        lineInputs.push({
          providerProductId: productSync.externalId,
          description: item.productName,
          quantity: qty,
          unitPriceExclusive: exclusiveUnit.toFixed(2),
          vatRate: new Prisma.Decimal(item.taxRate).toFixed(2),
        });
      }
    } catch (err) {
      await this.markFailed(invoice.id, err);
      throw this.invoices.toHttpExceptionPublic(err);
    }

    const providerInput: ProviderInvoiceInput = {
      localInvoiceId: invoice.id,
      localSaleId: sale.id,
      saleNumber: sale.saleNumber,
      providerCustomerId: customerSync.externalId,
      providerAddressId: addressSync.externalId,
      orderDate: formatBusinessDate(
        sale.createdAt,
        this.config.get('BUSINESS_TIMEZONE', { infer: true }) ??
          'Europe/Istanbul',
      ),
      currency: sale.currency,
      description: saleInvoiceDescription(sale.id),
      receiverEmail: sale.customer.email,
      lines: lineInputs,
      expectedGrandTotal: toMoneyString(sale.totalAmount),
    };

    try {
      const created = await provider.createInvoice(providerInput);

      if (
        created.grandTotal !== null &&
        !totalsMatch(created.grandTotal, providerInput.expectedGrandTotal)
      ) {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.FAILED,
            errorCode: 'TOTAL_MISMATCH',
            errorMessage: `KolayBi toplam (${created.grandTotal}) yerel toplamdan (${providerInput.expectedGrandTotal}) farklı`,
            externalDocumentId: created.externalDocumentId,
            invoiceNumber: created.invoiceNumber,
          },
        });
        throw new ConflictException({
          message: 'Fatura toplamı provider ile uyuşmuyor',
          code: 'TOTAL_MISMATCH',
        });
      }

      const success = await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.SUCCESS,
          externalDocumentId: created.externalDocumentId,
          invoiceNumber: created.invoiceNumber,
          uuid: created.uuid,
          errorCode: null,
          errorMessage: null,
          issuedAt: new Date(),
        },
      });
      return this.toResponse(success);
    } catch (err) {
      if (err instanceof ConflictException) throw err;

      if (err instanceof KolayBiApiError && err.retryable) {
        // Keep PENDING — do not auto-recreate (timeout may have created remotely).
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.PENDING,
            errorCode: err.code,
            errorMessage: err.message,
          },
        });
        throw this.invoices.toHttpExceptionPublic(err);
      }

      await this.markFailed(invoice.id, err);
      throw this.invoices.toHttpExceptionPublic(err);
    }
  }

  private async createPendingInvoice(data: {
    saleId: string;
    customerId: string;
    createdById: string;
    documentType: InvoiceDocumentType;
    idempotencyKey: string;
    currency: string;
    subtotal: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    billingAddressId: string;
    billingAddressSnapshot: Prisma.InputJsonValue;
  }) {
    try {
      return await this.prisma.invoice.create({
        data: {
          saleId: data.saleId,
          customerId: data.customerId,
          createdById: data.createdById,
          documentType: data.documentType,
          status: InvoiceStatus.PENDING,
          idempotencyKey: data.idempotencyKey,
          currency: data.currency,
          subtotal: data.subtotal,
          discountAmount: data.discountAmount,
          taxAmount: data.taxAmount,
          totalAmount: data.totalAmount,
          billingAddressId: data.billingAddressId,
          billingAddressSnapshot: data.billingAddressSnapshot,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const raced = await this.prisma.invoice.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
        });
        if (raced) {
          if (raced.status === InvoiceStatus.SUCCESS) {
            return raced;
          }
          return raced;
        }
      }
      throw err;
    }
  }

  private async resolveBillingAddress(
    customerId: string,
    billingAddressId?: string,
  ) {
    if (billingAddressId) {
      const address = await this.prisma.address.findUnique({
        where: { id: billingAddressId },
      });
      if (!address || address.userId !== customerId) {
        throw new BadRequestException(
          'Fatura adresi bu müşteriye ait değil veya bulunamadı',
        );
      }
      return address;
    }

    const addresses = await this.prisma.address.findMany({
      where: { userId: customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (!addresses.length) {
      throw new BadRequestException(
        'Fatura için müşteri adresi gerekli (billingAddressId veya kayıtlı adres)',
      );
    }
    const defaults = addresses.filter((a) => a.isDefault);
    if (defaults.length === 1) return defaults[0];
    if (addresses.length === 1) return addresses[0];
    throw new BadRequestException(
      'Birden fazla adres var; billingAddressId belirtin',
    );
  }

  private resolveDocumentType(
    isEInvoiceTaxpayer: boolean,
    requested?: InvoiceDocumentType,
  ): InvoiceDocumentType {
    const derived = isEInvoiceTaxpayer
      ? InvoiceDocumentType.E_INVOICE
      : InvoiceDocumentType.E_ARCHIVE;
    if (!requested) return derived;
    if (requested !== derived) {
      throw new BadRequestException(
        `Belge tipi müşteri mükellefiyetine uymuyor (beklenen: ${derived})`,
      );
    }
    return requested;
  }

  private async markFailed(invoiceId: string, err: unknown): Promise<void> {
    const code =
      err instanceof KolayBiApiError
        ? err.code
        : err instanceof HttpException
          ? 'HTTP_ERROR'
          : 'INVOICE_CREATE_FAILED';
    const message =
      err instanceof KolayBiApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Invoice create failed';

    this.logger.warn(
      JSON.stringify({
        event: 'invoice_create_failed',
        invoiceId,
        code,
      }),
    );

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.FAILED,
        errorCode: code,
        errorMessage: message.slice(0, 500),
      },
    });
  }

  private toResponse(invoice: {
    id: string;
    saleId: string;
    status: InvoiceStatus;
    provider: string;
    documentType: InvoiceDocumentType;
    externalDocumentId: string | null;
    invoiceNumber: string | null;
    uuid: string | null;
    currency: string;
    subtotal: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    errorCode: string | null;
    errorMessage: string | null;
  }): InvoiceFromSaleResponseDto {
    return {
      invoiceId: invoice.id,
      saleId: invoice.saleId,
      status: invoice.status,
      provider: invoice.provider,
      documentType: invoice.documentType,
      externalDocumentId: invoice.externalDocumentId,
      invoiceNumber: invoice.invoiceNumber,
      uuid: invoice.uuid,
      currency: invoice.currency,
      subtotal: toMoneyString(invoice.subtotal),
      taxAmount: toMoneyString(invoice.taxAmount),
      totalAmount: toMoneyString(invoice.totalAmount),
      errorCode: invoice.errorCode,
      errorMessage: invoice.errorMessage,
    };
  }
}

export function formatBusinessDate(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
}

export function totalsMatch(providerTotal: string, expected: string): boolean {
  const a = new Prisma.Decimal(providerTotal);
  const b = new Prisma.Decimal(expected);
  return a.sub(b).abs().lessThanOrEqualTo(new Prisma.Decimal('0.01'));
}
