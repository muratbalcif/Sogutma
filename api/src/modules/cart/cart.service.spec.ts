import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserType } from '@prisma/client';
import { CartService } from './cart.service';

describe('CartService', () => {
  const prisma = {
    cart: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    cartItem: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
  };

  const priceService = {
    resolvePrice: jest.fn(),
    resolvePricesForProducts: jest.fn(),
  };

  const inventoryService = {
    getAvailableQuantity: jest.fn(),
  };

  const service = new CartService(
    prisma as never,
    priceService as never,
    inventoryService as never,
  );

  const userId = 'user-1';
  const cartId = 'cart-1';
  const productId = 'product-1';

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.cart.upsert.mockResolvedValue({ id: cartId });
    prisma.product.findUnique.mockResolvedValue({
      id: productId,
      active: true,
    });
    inventoryService.getAvailableQuantity.mockResolvedValue(10);
    priceService.resolvePricesForProducts.mockResolvedValue(
      new Map([
        [productId, { amount: '2499.90', currency: 'TRY', type: 'RETAIL' }],
      ]),
    );
  });

  function mockLoadedCart(overrides?: {
    quantity?: number;
    active?: boolean;
    available?: number;
    price?: { amount: string; currency: string; type: string } | null;
  }) {
    const quantity = overrides?.quantity ?? 2;
    const active = overrides?.active ?? true;
    prisma.cart.findUnique.mockResolvedValue({
      id: cartId,
      userId,
      items: [
        {
          id: 'item-1',
          productId,
          quantity,
          product: {
            id: productId,
            name: 'Compressor',
            slug: 'compressor',
            sku: 'SKU-1',
            active,
            images: [],
          },
        },
      ],
    });
    inventoryService.getAvailableQuantity.mockResolvedValue(
      overrides?.available ?? 10,
    );
    priceService.resolvePricesForProducts.mockResolvedValue(
      new Map([
        [
          productId,
          overrides?.price === null
            ? null
            : (overrides?.price ?? {
                amount: '2499.90',
                currency: 'TRY',
                type: 'RETAIL',
              }),
        ],
      ]),
    );
  }

  it('creates a cart for the user on first access', async () => {
    mockLoadedCart({ quantity: 0 });
    prisma.cart.findUnique.mockResolvedValue({
      id: cartId,
      userId,
      items: [],
    });

    const cart = await service.getCart(userId, UserType.INDIVIDUAL);
    expect(prisma.cart.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
        create: { userId },
      }),
    );
    expect(cart.id).toBe(cartId);
    expect(cart.items).toEqual([]);
  });

  it('adds an item and recalculates totals with Decimal precision', async () => {
    prisma.cartItem.findUnique.mockResolvedValue(null);
    prisma.cartItem.upsert.mockResolvedValue({});
    mockLoadedCart({ quantity: 2 });

    const cart = await service.addItem(
      userId,
      productId,
      2,
      UserType.INDIVIDUAL,
    );

    expect(prisma.cartItem.upsert).toHaveBeenCalled();
    expect(cart.items[0].unitPrice).toBe('2499.90');
    expect(cart.items[0].subtotal).toBe('4999.80');
    expect(cart.summary.total).toBe('4999.80');
    expect(cart.summary.discount).toBe('0.00');
  });

  it('increases quantity when the same product is added again', async () => {
    prisma.cartItem.findUnique.mockResolvedValue({
      id: 'item-1',
      quantity: 2,
    });
    prisma.cartItem.upsert.mockResolvedValue({});
    mockLoadedCart({ quantity: 5 });

    await service.addItem(userId, productId, 3, UserType.INDIVIDUAL);

    expect(prisma.cartItem.upsert).toHaveBeenCalled();
    expect(inventoryService.getAvailableQuantity).toHaveBeenCalledWith(
      productId,
    );
  });

  it('updates quantity', async () => {
    prisma.cartItem.findUnique.mockResolvedValue({
      id: 'item-1',
      quantity: 2,
    });
    prisma.cartItem.update.mockResolvedValue({});
    mockLoadedCart({ quantity: 3 });

    const cart = await service.updateItem(
      userId,
      productId,
      3,
      UserType.INDIVIDUAL,
    );
    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: 3 },
    });
    expect(cart.items[0].quantity).toBe(3);
  });

  it('removes an item', async () => {
    prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });
    prisma.cart.findUnique.mockResolvedValue({
      id: cartId,
      userId,
      items: [],
    });

    const cart = await service.removeItem(
      userId,
      productId,
      UserType.INDIVIDUAL,
    );
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId, productId },
    });
    expect(cart.items).toEqual([]);
  });

  it('clears cart items without deleting the cart', async () => {
    prisma.cartItem.deleteMany.mockResolvedValue({ count: 2 });
    prisma.cart.findUnique.mockResolvedValue({
      id: cartId,
      userId,
      items: [],
    });

    await service.clearCart(userId, UserType.INDIVIDUAL);
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId },
    });
    expect(prisma.cart.upsert).toHaveBeenCalled();
  });

  it('resolves price through PriceService and stock through InventoryService', async () => {
    mockLoadedCart({ quantity: 2 });
    await service.getCart(userId, UserType.INDIVIDUAL);

    expect(priceService.resolvePricesForProducts).toHaveBeenCalledWith(
      [productId],
      { customerId: userId, userType: UserType.INDIVIDUAL },
    );
    expect(inventoryService.getAvailableQuantity).toHaveBeenCalledWith(
      productId,
    );
  });

  it('rejects inactive products on add', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: productId,
      active: false,
    });
    await expect(
      service.addItem(userId, productId, 1, UserType.INDIVIDUAL),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects insufficient stock on add', async () => {
    prisma.cartItem.findUnique.mockResolvedValue(null);
    inventoryService.getAvailableQuantity.mockResolvedValue(1);
    await expect(
      service.addItem(userId, productId, 2, UserType.INDIVIDUAL),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects missing products', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(
      service.addItem(userId, productId, 1, UserType.INDIVIDUAL),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('flags inactive products on get without removing them', async () => {
    mockLoadedCart({ active: false, quantity: 1 });
    const cart = await service.getCart(userId, UserType.INDIVIDUAL);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].available).toBe(false);
    expect(cart.items[0].issueCode).toBe('PRODUCT_INACTIVE');
  });

  it('reflects stock changes without silently reducing quantity', async () => {
    mockLoadedCart({ quantity: 5, available: 3 });
    const cart = await service.getCart(userId, UserType.INDIVIDUAL);
    expect(cart.items[0].quantity).toBe(5);
    expect(cart.items[0].availableQuantity).toBe(3);
    expect(cart.items[0].available).toBe(false);
    expect(cart.items[0].issueCode).toBe('INSUFFICIENT_STOCK');
  });

  it('reflects price changes from PriceService', async () => {
    mockLoadedCart({
      quantity: 2,
      price: { amount: '900.00', currency: 'TRY', type: 'CAMPAIGN' },
    });
    const cart = await service.getCart(userId, UserType.INDIVIDUAL);
    expect(cart.items[0].unitPrice).toBe('900.00');
    expect(cart.items[0].subtotal).toBe('1800.00');
    expect(cart.summary.total).toBe('1800.00');
  });

  it('validateCart returns structured issues', async () => {
    mockLoadedCart({ quantity: 5, available: 2, active: true });
    const result = await service.validateCart(userId, UserType.INDIVIDUAL);
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId,
          code: 'INSUFFICIENT_STOCK',
        }),
      ]),
    );
  });

  it('never uses floating point for money math', async () => {
    mockLoadedCart({
      quantity: 3,
      price: { amount: '2499.90', currency: 'TRY', type: 'RETAIL' },
    });
    const cart = await service.getCart(userId, UserType.INDIVIDUAL);
    expect(cart.items[0].subtotal).toBe('7499.70');
    expect(cart.summary.total).toBe(
      toMoneyString(new Prisma.Decimal('2499.90').mul(3)),
    );
  });

  it('does not expose another user cart', async () => {
    prisma.cart.findUnique.mockResolvedValue({
      id: cartId,
      userId: 'other-user',
      items: [],
    });
    await expect(
      service.calculateCart(cartId, userId, UserType.INDIVIDUAL),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function toMoneyString(value: Prisma.Decimal): string {
  return value.toFixed(2);
}
