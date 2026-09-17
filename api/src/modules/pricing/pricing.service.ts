import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PriceType, Prisma, UserType } from '@prisma/client';
import { toMoneyString } from '../../common/utils/money.util';
import { CampaignsService } from '../campaigns/campaigns.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerPriceDto,
  CreateProductPriceDto,
  CustomerPriceResponseDto,
  ProductPriceResponseDto,
  ResolvedPriceDto,
  UpdateCustomerPriceDto,
  UpdateProductPriceDto,
} from './dto/pricing.dto';

export interface PriceResolutionContext {
  customerId?: string;
  userType?: UserType;
}

@Injectable()
export class PriceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignsService: CampaignsService,
  ) {}

  /**
   * Price resolution order (deterministic):
   * 1. Customer-specific
   * 2. Corporate (corporate users)
   * 3. Wholesale (corporate users)
   * 4. Campaign module / ProductPrice CAMPAIGN (lower effective price wins;
   *    multi-campaign: higher priority → lower price → lower campaignId)
   * 5. Retail
   *
   * Clients must display this result only — never recompute discounts.
   */
  async resolvePrice(
    productId: string,
    context: PriceResolutionContext = {},
  ): Promise<ResolvedPriceDto | null> {
    const now = new Date();
    const retail = await this.findValidProductPrice(
      productId,
      PriceType.RETAIL,
      now,
    );
    const baseRetail = retail?.price ?? null;
    const currencyFallback = retail?.currency ?? 'TRY';

    if (context.customerId) {
      const customerPrice = await this.findValidCustomerPrice(
        context.customerId,
        productId,
        now,
      );
      if (customerPrice) {
        return this.toResolved(
          customerPrice.price,
          baseRetail ?? customerPrice.price,
          customerPrice.currency,
          'CUSTOMER',
          null,
          customerPrice.validTo,
        );
      }
    }

    if (context.userType === UserType.CORPORATE) {
      for (const type of [PriceType.CORPORATE, PriceType.WHOLESALE]) {
        const price = await this.findValidProductPrice(productId, type, now);
        if (price) {
          return this.toResolved(
            price.price,
            baseRetail ?? price.price,
            price.currency,
            price.type,
            null,
            price.validTo,
          );
        }
      }
    }

    const legacyCampaign = await this.findValidProductPrice(
      productId,
      PriceType.CAMPAIGN,
      now,
    );

    let campaignAmount: Prisma.Decimal | null = null;
    let campaignId: string | null = null;
    let campaignValidUntil: Date | null = null;

    if (retail) {
      const moduleCampaign = await this.campaignsService.resolveCampaignPrice(
        productId,
        retail.price,
        now,
      );
      if (moduleCampaign) {
        campaignAmount = moduleCampaign.amount;
        campaignId = moduleCampaign.campaignId;
      }
    }
    if (legacyCampaign) {
      if (!campaignAmount || legacyCampaign.price.lessThan(campaignAmount)) {
        campaignAmount = legacyCampaign.price;
        campaignId = null;
        campaignValidUntil = legacyCampaign.validTo;
      }
    }

    if (campaignAmount) {
      return this.toResolved(
        campaignAmount,
        baseRetail ?? campaignAmount,
        currencyFallback,
        PriceType.CAMPAIGN,
        campaignId,
        campaignValidUntil,
      );
    }

    if (retail) {
      return this.toResolved(
        retail.price,
        retail.price,
        retail.currency,
        retail.type,
        null,
        retail.validTo,
      );
    }

    return null;
  }

  private toResolved(
    final: Prisma.Decimal,
    base: Prisma.Decimal,
    currency: string,
    type: PriceType | 'CUSTOMER',
    campaignId: string | null,
    validUntil: Date | null,
  ): ResolvedPriceDto {
    const discount = base.greaterThan(final)
      ? base.sub(final)
      : new Prisma.Decimal(0);
    const pct = base.greaterThan(0)
      ? discount.div(base).mul(100).toDecimalPlaces(2)
      : new Prisma.Decimal(0);
    return {
      amount: toMoneyString(final),
      basePrice: toMoneyString(base),
      finalPrice: toMoneyString(final),
      discountAmount: toMoneyString(discount),
      discountPercentage: pct.toFixed(2),
      currency,
      type,
      campaignId,
      validUntil: validUntil ? validUntil.toISOString() : null,
    };
  }

  async resolvePricesForProducts(
    productIds: string[],
    context: PriceResolutionContext = {},
  ): Promise<Map<string, ResolvedPriceDto | null>> {
    const result = new Map<string, ResolvedPriceDto | null>();
    await Promise.all(
      productIds.map(async (productId) => {
        result.set(productId, await this.resolvePrice(productId, context));
      }),
    );
    return result;
  }

  async listProductPrices(
    productId: string,
  ): Promise<ProductPriceResponseDto[]> {
    await this.ensureProductExists(productId);
    const prices = await this.prisma.productPrice.findMany({
      where: { productId },
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });
    return prices.map((price) => this.toProductPriceResponse(price));
  }

  async createProductPrice(
    productId: string,
    dto: CreateProductPriceDto,
  ): Promise<ProductPriceResponseDto> {
    await this.ensureProductExists(productId);
    const price = this.parseMoney(dto.price);
    this.ensureValidRange(dto.validFrom, dto.validTo);

    const created = await this.prisma.productPrice.create({
      data: {
        productId,
        type: dto.type,
        price,
        currency: dto.currency ?? 'TRY',
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
        active: dto.active ?? true,
      },
    });

    return this.toProductPriceResponse(created);
  }

  async updateProductPrice(
    priceId: string,
    dto: UpdateProductPriceDto,
  ): Promise<ProductPriceResponseDto> {
    const existing = await this.prisma.productPrice.findUnique({
      where: { id: priceId },
    });
    if (!existing) {
      throw new NotFoundException('Price not found');
    }

    this.ensureValidRange(
      dto.validFrom === undefined
        ? existing.validFrom?.toISOString()
        : dto.validFrom,
      dto.validTo === undefined ? existing.validTo?.toISOString() : dto.validTo,
    );

    const updated = await this.prisma.productPrice.update({
      where: { id: priceId },
      data: {
        price: dto.price === undefined ? undefined : this.parseMoney(dto.price),
        currency: dto.currency,
        validFrom:
          dto.validFrom === undefined
            ? undefined
            : dto.validFrom
              ? new Date(dto.validFrom)
              : null,
        validTo:
          dto.validTo === undefined
            ? undefined
            : dto.validTo
              ? new Date(dto.validTo)
              : null,
        active: dto.active,
      },
    });

    return this.toProductPriceResponse(updated);
  }

  async deactivateProductPrice(
    priceId: string,
  ): Promise<ProductPriceResponseDto> {
    const existing = await this.prisma.productPrice.findUnique({
      where: { id: priceId },
    });
    if (!existing) {
      throw new NotFoundException('Price not found');
    }

    const updated = await this.prisma.productPrice.update({
      where: { id: priceId },
      data: { active: false },
    });
    return this.toProductPriceResponse(updated);
  }

  async listCustomerPrices(
    customerId: string,
  ): Promise<CustomerPriceResponseDto[]> {
    await this.ensureCustomerExists(customerId);
    const prices = await this.prisma.customerPrice.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return prices.map((price) => this.toCustomerPriceResponse(price));
  }

  async createCustomerPrice(
    customerId: string,
    dto: CreateCustomerPriceDto,
  ): Promise<CustomerPriceResponseDto> {
    await this.ensureCustomerExists(customerId);
    await this.ensureProductExists(dto.productId);
    this.ensureValidRange(dto.validFrom, dto.validTo);
    await this.ensureNoCustomerPriceConflict(
      customerId,
      dto.productId,
      dto.validFrom,
      dto.validTo,
    );

    const created = await this.prisma.customerPrice.create({
      data: {
        customerId,
        productId: dto.productId,
        price: this.parseMoney(dto.price),
        currency: dto.currency ?? 'TRY',
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
        active: dto.active ?? true,
      },
    });

    return this.toCustomerPriceResponse(created);
  }

  async updateCustomerPrice(
    id: string,
    dto: UpdateCustomerPriceDto,
  ): Promise<CustomerPriceResponseDto> {
    const existing = await this.prisma.customerPrice.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Customer price not found');
    }

    this.ensureValidRange(
      dto.validFrom === undefined
        ? existing.validFrom?.toISOString()
        : dto.validFrom,
      dto.validTo === undefined ? existing.validTo?.toISOString() : dto.validTo,
    );

    const updated = await this.prisma.customerPrice.update({
      where: { id },
      data: {
        price: dto.price === undefined ? undefined : this.parseMoney(dto.price),
        currency: dto.currency,
        validFrom:
          dto.validFrom === undefined
            ? undefined
            : dto.validFrom
              ? new Date(dto.validFrom)
              : null,
        validTo:
          dto.validTo === undefined
            ? undefined
            : dto.validTo
              ? new Date(dto.validTo)
              : null,
        active: dto.active,
      },
    });

    return this.toCustomerPriceResponse(updated);
  }

  async deactivateCustomerPrice(id: string): Promise<CustomerPriceResponseDto> {
    const existing = await this.prisma.customerPrice.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Customer price not found');
    }

    const updated = await this.prisma.customerPrice.update({
      where: { id },
      data: { active: false },
    });
    return this.toCustomerPriceResponse(updated);
  }

  private async findValidCustomerPrice(
    customerId: string,
    productId: string,
    now: Date,
  ) {
    return this.prisma.customerPrice.findFirst({
      where: {
        customerId,
        productId,
        active: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validTo: null }, { validTo: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findValidProductPrice(
    productId: string,
    type: PriceType,
    now: Date,
  ) {
    return this.prisma.productPrice.findFirst({
      where: {
        productId,
        type,
        active: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validTo: null }, { validTo: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private parseMoney(value: string): Prisma.Decimal {
    const decimal = new Prisma.Decimal(value);
    if (decimal.lessThan(0)) {
      throw new BadRequestException('Price cannot be negative');
    }
    return decimal;
  }

  private ensureValidRange(
    validFrom?: string | null,
    validTo?: string | null,
  ): void {
    if (validFrom && validTo && new Date(validFrom) > new Date(validTo)) {
      throw new BadRequestException('validFrom must be before validTo');
    }
  }

  private async ensureNoCustomerPriceConflict(
    customerId: string,
    productId: string,
    validFrom?: string | null,
    validTo?: string | null,
    excludeId?: string,
  ): Promise<void> {
    const from = validFrom ? new Date(validFrom) : null;
    const to = validTo ? new Date(validTo) : null;
    const existing = await this.prisma.customerPrice.findMany({
      where: {
        customerId,
        productId,
        active: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    for (const row of existing) {
      const overlap =
        (from === null || row.validTo === null || from <= row.validTo) &&
        (to === null || row.validFrom === null || to >= row.validFrom);
      if (overlap) {
        throw new BadRequestException(
          'Overlapping active customer price already exists for this product',
        );
      }
    }
  }

  private async ensureProductExists(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private async ensureCustomerExists(customerId: string): Promise<void> {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
  }

  private toProductPriceResponse(price: {
    id: string;
    productId: string;
    type: PriceType;
    price: Prisma.Decimal;
    currency: string;
    validFrom: Date | null;
    validTo: Date | null;
    active: boolean;
  }): ProductPriceResponseDto {
    return {
      id: price.id,
      productId: price.productId,
      type: price.type,
      price: toMoneyString(price.price),
      currency: price.currency,
      validFrom: price.validFrom,
      validTo: price.validTo,
      active: price.active,
    };
  }

  private toCustomerPriceResponse(price: {
    id: string;
    customerId: string;
    productId: string;
    price: Prisma.Decimal;
    currency: string;
    validFrom: Date | null;
    validTo: Date | null;
    active: boolean;
  }): CustomerPriceResponseDto {
    return {
      id: price.id,
      customerId: price.customerId,
      productId: price.productId,
      price: toMoneyString(price.price),
      currency: price.currency,
      validFrom: price.validFrom,
      validTo: price.validTo,
      active: price.active,
    };
  }
}
