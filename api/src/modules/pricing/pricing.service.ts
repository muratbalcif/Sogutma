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
   * Price resolution order:
   * 1. Customer-specific
   * 2. Corporate (corporate users)
   * 3. Wholesale (corporate users)
   * 4. Campaign module / ProductPrice CAMPAIGN (lower effective price wins)
   * 5. Retail
   */
  async resolvePrice(
    productId: string,
    context: PriceResolutionContext = {},
  ): Promise<ResolvedPriceDto | null> {
    const now = new Date();

    if (context.customerId) {
      const customerPrice = await this.findValidCustomerPrice(
        context.customerId,
        productId,
        now,
      );
      if (customerPrice) {
        return {
          amount: toMoneyString(customerPrice.price),
          currency: customerPrice.currency,
          type: 'CUSTOMER',
        };
      }
    }

    if (context.userType === UserType.CORPORATE) {
      for (const type of [PriceType.CORPORATE, PriceType.WHOLESALE]) {
        const price = await this.findValidProductPrice(productId, type, now);
        if (price) {
          return {
            amount: toMoneyString(price.price),
            currency: price.currency,
            type: price.type,
          };
        }
      }
    }

    const retail = await this.findValidProductPrice(
      productId,
      PriceType.RETAIL,
      now,
    );
    const legacyCampaign = await this.findValidProductPrice(
      productId,
      PriceType.CAMPAIGN,
      now,
    );

    let campaignAmount: Prisma.Decimal | null = null;
    if (retail) {
      const moduleCampaign = await this.campaignsService.resolveCampaignPrice(
        productId,
        retail.price,
        now,
      );
      if (moduleCampaign) {
        campaignAmount = moduleCampaign.amount;
      }
    }
    if (legacyCampaign) {
      if (!campaignAmount || legacyCampaign.price.lessThan(campaignAmount)) {
        campaignAmount = legacyCampaign.price;
      }
    }

    if (campaignAmount) {
      return {
        amount: toMoneyString(campaignAmount),
        currency: retail?.currency ?? legacyCampaign?.currency ?? 'TRY',
        type: PriceType.CAMPAIGN,
      };
    }

    if (retail) {
      return {
        amount: toMoneyString(retail.price),
        currency: retail.currency,
        type: retail.type,
      };
    }

    return null;
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
