import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ExternalEntityType,
  InvoiceProviderCode,
  UserStatus,
  UserType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KolayBiApiError } from './clients/kolaybi.errors';
import {
  INVOICE_PROVIDERS,
  InvoiceProvider,
  InvoiceProviderHealth,
  KOLAYBI_INVOICE_PROVIDER,
} from './providers/invoice-provider.interface';
import type {
  ProviderAddressInput,
  ProviderCustomerInput,
  ProviderEntitySyncResult,
  ProviderProductInput,
} from './providers/provider-customer.types';

export type CustomerSyncResponse = ProviderEntitySyncResult & {
  userId: string;
};

export type AddressSyncResponse = ProviderEntitySyncResult & {
  addressId: string;
  userId: string;
};

export type ProductSyncResponse = ProviderEntitySyncResult & {
  productId: string;
  sku: string;
};

/**
 * Domain orchestration for invoice providers.
 * Does not call KolayBi HTTP endpoints directly.
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);
  private readonly providers: Map<string, InvoiceProvider>;

  constructor(
    @Inject(INVOICE_PROVIDERS) providerList: InvoiceProvider[],
    private readonly prisma: PrismaService,
  ) {
    this.providers = new Map(providerList.map((p) => [p.code, p]));
  }

  resolveProvider(code = KOLAYBI_INVOICE_PROVIDER): InvoiceProvider {
    const provider = this.providers.get(code);
    if (!provider) {
      throw new NotFoundException(`Invoice provider not found: ${code}`);
    }
    return provider;
  }

  async providerHealth(
    code = KOLAYBI_INVOICE_PROVIDER,
  ): Promise<InvoiceProviderHealth> {
    const provider = this.resolveProvider(code);
    try {
      return await provider.healthCheck();
    } catch (err) {
      throw this.toHttpException(err);
    }
  }

  async syncCustomer(
    userId: string,
    providerCode = KOLAYBI_INVOICE_PROVIDER,
  ): Promise<CustomerSyncResponse> {
    const provider = this.resolveProvider(providerCode);
    this.assertProviderEnabled(provider);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { corporateCustomer: true },
    });
    if (!user) {
      throw new NotFoundException('Müşteri bulunamadı');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Müşteri aktif değil');
    }

    const input = this.toCustomerInput(user);
    this.validateCustomerInput(input);

    const existing = await this.findLink(
      provider.code,
      ExternalEntityType.USER,
      userId,
    );

    let result: ProviderEntitySyncResult;
    try {
      result = await provider.ensureCustomer(
        input,
        existing?.externalId ?? null,
      );
    } catch (err) {
      throw this.toHttpException(err);
    }

    await this.upsertLink(
      provider.code,
      ExternalEntityType.USER,
      userId,
      result.externalId,
    );

    return { ...result, userId };
  }

  async syncAddress(
    addressId: string,
    providerCode = KOLAYBI_INVOICE_PROVIDER,
  ): Promise<AddressSyncResponse> {
    const provider = this.resolveProvider(providerCode);
    this.assertProviderEnabled(provider);

    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });
    if (!address) {
      throw new NotFoundException('Adres bulunamadı');
    }

    // Associate must exist first
    let userLink = await this.findLink(
      provider.code,
      ExternalEntityType.USER,
      address.userId,
    );
    if (!userLink) {
      await this.syncCustomer(address.userId, providerCode);
      userLink = await this.findLink(
        provider.code,
        ExternalEntityType.USER,
        address.userId,
      );
    }
    if (!userLink) {
      throw new ServiceUnavailableException({
        message: 'Müşteri KolayBi associate bağlantısı oluşturulamadı',
        code: 'ASSOCIATE_LINK_MISSING',
      });
    }

    this.validateAddress(address);

    const input: ProviderAddressInput = {
      localAddressId: address.id,
      localUserId: address.userId,
      providerCustomerId: userLink.externalId,
      addressLine: address.addressLine,
      city: address.city,
      district: address.district,
      countryCode: address.country,
      postalCode: address.postalCode,
      neighborhood: address.neighborhood,
    };

    const existing = await this.findLink(
      provider.code,
      ExternalEntityType.ADDRESS,
      addressId,
    );

    let result: ProviderEntitySyncResult;
    try {
      result = await provider.ensureAddress(
        input,
        existing?.externalId ?? null,
      );
    } catch (err) {
      throw this.toHttpException(err);
    }

    await this.upsertLink(
      provider.code,
      ExternalEntityType.ADDRESS,
      addressId,
      result.externalId,
    );

    return { ...result, addressId, userId: address.userId };
  }

  async syncProduct(
    productId: string,
    providerCode = KOLAYBI_INVOICE_PROVIDER,
  ): Promise<ProductSyncResponse> {
    const provider = this.resolveProvider(providerCode);
    this.assertProviderEnabled(provider);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        barcode: true,
        vatRate: true,
        active: true,
      },
    });
    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    const input = this.toProductInput(product);
    this.validateProductInput(input);

    const existing = await this.findLink(
      provider.code,
      ExternalEntityType.PRODUCT,
      productId,
    );

    let result: ProviderEntitySyncResult;
    try {
      result = await provider.ensureProduct(
        input,
        existing?.externalId ?? null,
      );
    } catch (err) {
      throw this.toHttpException(err);
    }

    await this.upsertLink(
      provider.code,
      ExternalEntityType.PRODUCT,
      productId,
      result.externalId,
    );

    return { ...result, productId, sku: product.sku };
  }

  private toProductInput(product: {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    barcode: string | null;
    vatRate: { toFixed: (digits: number) => string };
  }): ProviderProductInput {
    return {
      localProductId: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      barcode: product.barcode,
      vatRate: product.vatRate.toFixed(2),
    };
  }

  private validateProductInput(input: ProviderProductInput): void {
    if (!input.sku.trim()) {
      throw new BadRequestException('Ürün SKU zorunlu');
    }
    if (!input.name.trim()) {
      throw new BadRequestException('Ürün adı zorunlu');
    }
    if (!/^\d+(\.\d{1,2})?$/.test(input.vatRate.trim())) {
      throw new BadRequestException('Geçerli KDV oranı (vatRate) gerekli');
    }
  }

  private toCustomerInput(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    identityNumber: string | null;
    userType: UserType;
    corporateCustomer: {
      companyName: string;
      taxNumber: string;
      taxOffice: string;
    } | null;
  }): ProviderCustomerInput {
    if (user.userType === UserType.CORPORATE) {
      const corp = user.corporateCustomer;
      return {
        localUserId: user.id,
        type: 'CORPORATE',
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        taxOrIdentityNumber: corp?.taxNumber?.trim() ?? '',
        companyName: corp?.companyName ?? null,
        taxOffice: corp?.taxOffice ?? null,
      };
    }

    return {
      localUserId: user.id,
      type: 'INDIVIDUAL',
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      taxOrIdentityNumber: user.identityNumber?.trim() ?? '',
      companyName: null,
      taxOffice: null,
    };
  }

  private validateCustomerInput(input: ProviderCustomerInput): void {
    if (input.type === 'INDIVIDUAL') {
      if (input.firstName.trim().length < 2) {
        throw new BadRequestException(
          'Bireysel müşteri adı en az 2 karakter olmalı',
        );
      }
      if (input.lastName.trim().length < 2) {
        throw new BadRequestException(
          'Bireysel müşteri soyadı en az 2 karakter olmalı',
        );
      }
      if (!/^\d{11}$/.test(input.taxOrIdentityNumber)) {
        throw new BadRequestException(
          'Bireysel müşteri için geçerli TCKN (11 hane) gerekli',
        );
      }
      return;
    }

    if (!input.companyName || input.companyName.trim().length < 2) {
      throw new BadRequestException(
        'Kurumsal müşteri için firma adı (en az 2 karakter) gerekli',
      );
    }
    if (!/^\d{10}$/.test(input.taxOrIdentityNumber)) {
      throw new BadRequestException(
        'Kurumsal müşteri için geçerli VKN (10 hane) gerekli',
      );
    }
    if (!input.taxOffice?.trim()) {
      throw new BadRequestException(
        'Kurumsal müşteri için vergi dairesi gerekli',
      );
    }
  }

  private validateAddress(address: {
    city: string;
    district: string;
    addressLine: string;
    country: string;
  }): void {
    if (!address.city?.trim() || !address.district?.trim()) {
      throw new BadRequestException('Adres için şehir ve ilçe zorunlu');
    }
    if (!address.addressLine?.trim()) {
      throw new BadRequestException('Adres satırı zorunlu');
    }
    if (!address.country?.trim()) {
      throw new BadRequestException('Ülke zorunlu');
    }
  }

  /** Used by InvoiceFromSaleService (same module). */
  assertProviderEnabledPublic(provider: InvoiceProvider): void {
    this.assertProviderEnabled(provider);
  }

  /** Used by InvoiceFromSaleService (same module). */
  toHttpExceptionPublic(err: unknown): HttpException {
    return this.toHttpException(err);
  }

  private assertProviderEnabled(provider: InvoiceProvider): void {
    if (!provider.enabled) {
      throw new ServiceUnavailableException({
        message:
          'Invoice provider not configured (KOLAYBI_API_BASE_URL / KOLAYBI_API_KEY / KOLAYBI_CHANNEL)',
        code: 'KOLAYBI_NOT_CONFIGURED',
      });
    }
  }

  private providerCodeEnum(code: string): InvoiceProviderCode {
    if (code === InvoiceProviderCode.KOLAYBI) {
      return InvoiceProviderCode.KOLAYBI;
    }
    throw new BadRequestException(`Unsupported invoice provider: ${code}`);
  }

  private findLink(
    providerCode: string,
    entityType: ExternalEntityType,
    entityId: string,
  ) {
    return this.prisma.externalEntityLink.findUnique({
      where: {
        provider_entityType_entityId: {
          provider: this.providerCodeEnum(providerCode),
          entityType,
          entityId,
        },
      },
    });
  }

  private async upsertLink(
    providerCode: string,
    entityType: ExternalEntityType,
    entityId: string,
    externalId: string,
  ): Promise<void> {
    const provider = this.providerCodeEnum(providerCode);
    try {
      await this.prisma.externalEntityLink.upsert({
        where: {
          provider_entityType_entityId: {
            provider,
            entityType,
            entityId,
          },
        },
        create: {
          provider,
          entityType,
          entityId,
          externalId,
        },
        update: {
          externalId,
        },
      });
    } catch (err) {
      this.logger.error(
        JSON.stringify({
          event: 'external_entity_link_upsert_failed',
          provider: providerCode,
          entityType,
          entityId,
          // never log full tax ids; externalId is provider numeric id — ok
          externalId,
        }),
      );
      throw err;
    }
  }

  private toHttpException(err: unknown): HttpException {
    if (err instanceof KolayBiApiError) {
      if (err.code === 'KOLAYBI_NOT_CONFIGURED' || err.retryable) {
        return new ServiceUnavailableException({
          message: err.message,
          code: err.code,
        });
      }
      return new HttpException(
        { message: err.message, code: err.code },
        err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 502,
      );
    }
    if (err instanceof HttpException) {
      return err;
    }
    return new ServiceUnavailableException({
      message: 'Invoice provider unavailable',
      code: 'INVOICE_PROVIDER_ERROR',
    });
  }
}
