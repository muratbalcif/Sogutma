import { ConflictException, Injectable } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { AddressesService } from '../addresses/addresses.service';
import { InventoryService } from '../inventory/inventory.service';
import { PriceService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CheckoutValidateDto,
  CheckoutValidationResponseDto,
} from './dto/order.dto';
import { calculateCheckoutLines, toCheckoutItems } from './order-calculation';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceService: PriceService,
    private readonly inventoryService: InventoryService,
    private readonly addressesService: AddressesService,
  ) {}

  async validate(
    userId: string,
    userType: UserType,
    dto: CheckoutValidateDto,
  ): Promise<CheckoutValidationResponseDto> {
    await this.addressesService.getOwned(userId, dto.shippingAddressId);
    await this.addressesService.getOwned(userId, dto.billingAddressId);

    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                active: true,
                vatRate: true,
              },
            },
          },
        },
      },
    });

    const items = cart?.items ?? [];
    if (items.length === 0) {
      return {
        valid: false,
        items: [],
        issues: [{ code: 'EMPTY_CART', message: 'Cart is empty' }],
      };
    }

    const productIds = items.map((item) => item.productId);
    const prices = await this.priceService.resolvePricesForProducts(
      productIds,
      { customerId: userId, userType },
    );
    const stocks = new Map<string, number>();
    await Promise.all(
      productIds.map(async (productId) => {
        stocks.set(
          productId,
          await this.inventoryService.getAvailableQuantity(productId),
        );
      }),
    );

    const calculation = calculateCheckoutLines({
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        product: item.product,
      })),
      prices,
      stocks,
    });

    if (!calculation.valid) {
      return {
        valid: false,
        items: toCheckoutItems(calculation.lines),
        issues: calculation.issues,
      };
    }

    if (!calculation.summary) {
      throw new ConflictException('Unable to calculate checkout totals');
    }

    return {
      valid: true,
      items: toCheckoutItems(calculation.lines),
      summary: calculation.summary,
      issues: [],
    };
  }
}
