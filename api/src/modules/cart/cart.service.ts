import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserType } from '@prisma/client';
import {
  multiplyMoney,
  sumMoney,
  toMoneyString,
} from '../../common/utils/money.util';
import { InventoryService } from '../inventory/inventory.service';
import { PriceService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CartIssueCode,
  CartItemResponseDto,
  CartResponseDto,
  CartValidationIssueDto,
  CartValidationResponseDto,
} from './dto/cart.dto';

type CartProductInclude = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  active: boolean;
  images: Array<{
    id: string;
    url: string;
    alt: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }>;
};

type CartWithItems = {
  id: string;
  userId: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    product: CartProductInclude;
  }>;
};

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceService: PriceService,
    private readonly inventoryService: InventoryService,
  ) {}

  async getCart(userId: string, userType?: UserType): Promise<CartResponseDto> {
    const cart = await this.ensureCart(userId);
    return this.calculateCart(cart.id, userId, userType);
  }

  async addItem(
    userId: string,
    productId: string,
    quantity: number,
    userType?: UserType,
  ): Promise<CartResponseDto> {
    this.assertValidQuantity(quantity);
    await this.assertProductPurchasable(productId);

    const cart = await this.ensureCart(userId);
    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: { cartId: cart.id, productId },
      },
    });

    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    await this.assertSufficientStock(productId, nextQuantity);

    await this.prisma.cartItem.upsert({
      where: {
        cartId_productId: { cartId: cart.id, productId },
      },
      create: {
        cartId: cart.id,
        productId,
        quantity: nextQuantity,
      },
      update: {
        quantity: nextQuantity,
      },
    });

    return this.calculateCart(cart.id, userId, userType);
  }

  async updateItem(
    userId: string,
    productId: string,
    quantity: number,
    userType?: UserType,
  ): Promise<CartResponseDto> {
    this.assertValidQuantity(quantity);
    await this.assertProductPurchasable(productId);

    const cart = await this.ensureCart(userId);
    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: { cartId: cart.id, productId },
      },
    });
    if (!existing) {
      throw new NotFoundException('Cart item not found');
    }

    await this.assertSufficientStock(productId, quantity);

    await this.prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity },
    });

    return this.calculateCart(cart.id, userId, userType);
  }

  async removeItem(
    userId: string,
    productId: string,
    userType?: UserType,
  ): Promise<CartResponseDto> {
    const cart = await this.ensureCart(userId);
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId },
    });
    return this.calculateCart(cart.id, userId, userType);
  }

  async clearCart(
    userId: string,
    userType?: UserType,
  ): Promise<CartResponseDto> {
    const cart = await this.ensureCart(userId);
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });
    return this.calculateCart(cart.id, userId, userType);
  }

  async validateCart(
    userId: string,
    userType?: UserType,
  ): Promise<CartValidationResponseDto> {
    const cart = await this.loadCartWithItems(userId);
    if (!cart || cart.items.length === 0) {
      return { valid: true, issues: [] };
    }

    const issues: CartValidationIssueDto[] = [];
    const productIds = cart.items.map((item) => item.productId);
    const prices = await this.priceService.resolvePricesForProducts(
      productIds,
      { customerId: userId, userType },
    );
    const stocks = await this.loadAvailableQuantities(productIds);

    for (const item of cart.items) {
      const product = item.product;
      if (!product) {
        issues.push({
          productId: item.productId,
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product no longer exists',
        });
        continue;
      }
      if (!product.active) {
        issues.push({
          productId: item.productId,
          code: 'PRODUCT_INACTIVE',
          message: 'Product is inactive',
        });
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        issues.push({
          productId: item.productId,
          code: 'INVALID_QUANTITY',
          message: 'Quantity must be a positive integer',
        });
      }
      const price = prices.get(item.productId);
      if (!price) {
        issues.push({
          productId: item.productId,
          code: 'PRICE_UNAVAILABLE',
          message: 'Price cannot be resolved for this product',
        });
      }
      const available = stocks.get(item.productId) ?? 0;
      if (item.quantity > available) {
        issues.push({
          productId: item.productId,
          code: 'INSUFFICIENT_STOCK',
          message: 'Requested quantity is greater than available stock',
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  async calculateCart(
    cartId: string,
    userId: string,
    userType?: UserType,
  ): Promise<CartResponseDto> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            product: {
              include: {
                images: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!cart || cart.userId !== userId) {
      throw new NotFoundException('Cart not found');
    }

    return this.toCartResponse(cart, userId, userType);
  }

  private async ensureCart(userId: string): Promise<{ id: string }> {
    return this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });
  }

  private async loadCartWithItems(
    userId: string,
  ): Promise<CartWithItems | null> {
    return this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    });
  }

  private async toCartResponse(
    cart: CartWithItems,
    userId: string,
    userType?: UserType,
  ): Promise<CartResponseDto> {
    const productIds = cart.items.map((item) => item.productId);
    const prices = await this.priceService.resolvePricesForProducts(
      productIds,
      { customerId: userId, userType },
    );
    const stocks = await this.loadAvailableQuantities(productIds);

    const items: CartItemResponseDto[] = [];
    const subtotals: Prisma.Decimal[] = [];
    let currency = 'TRY';

    for (const item of cart.items) {
      const availableQuantity = stocks.get(item.productId) ?? 0;
      const price = prices.get(item.productId) ?? null;
      const issueCode = this.resolveItemIssue(
        item.product,
        item.quantity,
        availableQuantity,
        price != null,
      );

      let unitPrice: string | null = null;
      let subtotal: string | null = null;
      let itemCurrency: string | null = null;

      if (price) {
        const unit = new Prisma.Decimal(price.amount);
        const line = multiplyMoney(unit, item.quantity);
        unitPrice = toMoneyString(unit);
        subtotal = toMoneyString(line);
        itemCurrency = price.currency;
        currency = price.currency;
        subtotals.push(line);
      }

      items.push({
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          sku: item.product.sku,
          images: item.product.images.map((image) => ({
            id: image.id,
            url: image.url,
            alt: image.alt,
            sortOrder: image.sortOrder,
            isPrimary: image.isPrimary,
          })),
        },
        quantity: item.quantity,
        unitPrice,
        currency: itemCurrency,
        subtotal,
        availableQuantity,
        available:
          item.product.active &&
          item.quantity > 0 &&
          item.quantity <= availableQuantity &&
          price != null,
        issueCode,
      });
    }

    const subtotal = sumMoney(subtotals);
    const discount = new Prisma.Decimal(0);
    const total = subtotal.sub(discount);

    return {
      id: cart.id,
      items,
      summary: {
        subtotal: toMoneyString(subtotal),
        discount: toMoneyString(discount),
        total: toMoneyString(total),
        currency,
      },
    };
  }

  private resolveItemIssue(
    product: CartProductInclude | null,
    quantity: number,
    availableQuantity: number,
    hasPrice: boolean,
  ): CartIssueCode | null {
    if (!product) {
      return 'PRODUCT_NOT_FOUND';
    }
    if (!product.active) {
      return 'PRODUCT_INACTIVE';
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return 'INVALID_QUANTITY';
    }
    if (!hasPrice) {
      return 'PRICE_UNAVAILABLE';
    }
    if (quantity > availableQuantity) {
      return 'INSUFFICIENT_STOCK';
    }
    return null;
  }

  private async loadAvailableQuantities(
    productIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    await Promise.all(
      productIds.map(async (productId) => {
        result.set(
          productId,
          await this.inventoryService.getAvailableQuantity(productId),
        );
      }),
    );
    return result;
  }

  private assertValidQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive integer');
    }
  }

  private async assertProductPurchasable(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, active: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (!product.active) {
      throw new BadRequestException('Product is inactive');
    }
  }

  private async assertSufficientStock(
    productId: string,
    quantity: number,
  ): Promise<void> {
    const available =
      await this.inventoryService.getAvailableQuantity(productId);
    if (quantity > available) {
      throw new ConflictException('Insufficient stock');
    }
  }
}
