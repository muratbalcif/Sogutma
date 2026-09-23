import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PosPaymentMethod, PosSaleStatus, Prisma } from '@prisma/client';
import { PosService } from './pos.service';

function money(v: string) {
  return new Prisma.Decimal(v);
}

describe('PosService (Phase 1)', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
    posRegister: { findUnique: jest.fn(), findMany: jest.fn() },
    posSale: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    posSaleNumberSequence: { upsert: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const inventory = {
    sellAvailableInTransaction: jest.fn(),
  };

  const prices = {
    resolvePrice: jest.fn(),
  };

  const accounting = {
    assertCreditLimitAllows: jest.fn().mockResolvedValue(undefined),
    recordIfAbsent: jest.fn().mockResolvedValue({ created: true }),
    getCurrentAccount: jest.fn().mockResolvedValue({
      balance: '0.00',
      currency: 'TRY',
      creditLimit: null,
      allowCredit: false,
    }),
  };

  const audit = { log: jest.fn() };

  const config = {
    get: jest.fn().mockReturnValue('Europe/Istanbul'),
  };

  const service = new PosService(
    prisma as never,
    inventory as never,
    prices as never,
    accounting as never,
    audit as never,
    config as never,
  );

  const actor = {
    id: 'cashier-1',
    email: 'pos@test.com',
    firstName: 'Pos',
    lastName: 'User',
    phone: null,
    userType: 'INDIVIDUAL' as const,
    status: 'ACTIVE' as const,
    roles: ['POS_CASHIER'],
    permissions: ['pos.sell', 'pos.read', 'pos.discount'],
  };

  const baseDto = {
    registerId: 'reg-1',
    items: [{ productId: 'p1', quantity: 2 }],
    payments: [{ method: PosPaymentMethod.CASH, amount: 200 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.posSale.findUnique.mockResolvedValue(null);
    prisma.posRegister.findUnique.mockResolvedValue({
      id: 'reg-1',
      name: 'Kasa 1',
      code: 'KASA1',
      isActive: true,
    });
  });

  it('rejects empty items', async () => {
    await expect(
      service.createSale(
        { ...baseDto, items: [], payments: baseDto.payments },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects inactive register', async () => {
    prisma.posRegister.findUnique.mockResolvedValue({
      id: 'reg-1',
      name: 'Kasa 1',
      code: 'KASA1',
      isActive: false,
    });
    await expect(service.createSale(baseDto, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects ON_ACCOUNT without customer', async () => {
    await expect(
      service.createSale(
        {
          ...baseDto,
          payments: [{ method: PosPaymentMethod.ON_ACCOUNT, amount: 200 }],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects discount without pos.discount', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Ürün', sku: 'SKU1', barcode: null, vatRate: 20 },
    ]);
    prices.resolvePrice.mockResolvedValue({
      amount: '100.00',
      currency: 'TRY',
    });

    const noDiscount = { ...actor, permissions: ['pos.sell', 'pos.read'] };
    await expect(
      service.createSale(
        {
          ...baseDto,
          cartDiscountAmount: 10,
          payments: [{ method: PosPaymentMethod.CASH, amount: 190 }],
        },
        noDiscount,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects payment total mismatch', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Ürün', sku: 'SKU1', barcode: null, vatRate: 20 },
    ]);
    prices.resolvePrice.mockResolvedValue({
      amount: '100.00',
      currency: 'TRY',
    });

    await expect(
      service.createSale(
        {
          ...baseDto,
          payments: [{ method: PosPaymentMethod.CASH, amount: 50 }],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates sale, stocks out, returns saleNumber POS-*', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Ürün', sku: 'SKU1', barcode: '869', vatRate: 20 },
    ]);
    prices.resolvePrice.mockResolvedValue({
      amount: '100.00',
      currency: 'TRY',
    });

    const created = {
      id: 'sale-1',
      saleNumber: 'POS-20260923-000001',
      registerId: 'reg-1',
      userId: 'cashier-1',
      customerId: null,
      status: PosSaleStatus.COMPLETED,
      currency: 'TRY',
      subtotal: money('166.67'),
      discountTotal: money('0.00'),
      taxTotal: money('33.33'),
      grandTotal: money('200.00'),
      note: null,
      idempotencyKey: null,
      completedAt: new Date(),
      createdAt: new Date(),
      items: [
        {
          id: 'item-1',
          productId: 'p1',
          productName: 'Ürün',
          sku: 'SKU1',
          barcode: '869',
          quantity: 2,
          unitPrice: money('100.00'),
          discountAmount: money('0.00'),
          taxRate: money('20.00'),
          taxAmount: money('33.33'),
          lineSubtotal: money('166.67'),
          lineTotal: money('200.00'),
          createdAt: new Date(),
        },
      ],
      payments: [
        {
          id: 'pay-1',
          method: PosPaymentMethod.CASH,
          amount: money('200.00'),
          status: 'COMPLETED',
          referenceNumber: null,
          createdAt: new Date(),
        },
      ],
      returns: [],
      customer: null,
      user: {
        id: 'cashier-1',
        firstName: 'Pos',
        lastName: 'User',
        email: 'pos@test.com',
      },
      register: {
        id: 'reg-1',
        name: 'Kasa 1',
        code: 'KASA1',
        isActive: true,
        openedAt: null,
        closedAt: null,
      },
    };

    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
      const tx = {
        posSale: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(created),
        },
        posSaleNumberSequence: { upsert: jest.fn() },
        $queryRaw: jest.fn().mockResolvedValue([{ lastValue: 1 }]),
      };
      return Promise.resolve(fn(tx));
    });

    inventory.sellAvailableInTransaction.mockResolvedValue({});

    const result = await service.createSale(baseDto, actor);

    expect(result.saleNumber).toBe('POS-20260923-000001');
    expect(result.grandTotal).toBe('200.00');
    expect(inventory.sellAvailableInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      'p1',
      2,
      expect.objectContaining({
        referenceType: 'POS_SALE',
        referenceId: 'item-1',
      }),
    );
    expect(audit.log).toHaveBeenCalled();
  });

  it('returns existing sale on idempotency key hit', async () => {
    const existing = {
      id: 'sale-1',
      saleNumber: 'POS-20260923-000001',
      registerId: 'reg-1',
      userId: 'cashier-1',
      customerId: null,
      status: PosSaleStatus.COMPLETED,
      currency: 'TRY',
      subtotal: money('100.00'),
      discountTotal: money('0.00'),
      taxTotal: money('0.00'),
      grandTotal: money('100.00'),
      note: null,
      idempotencyKey: 'key-1',
      completedAt: new Date(),
      createdAt: new Date(),
      items: [],
      payments: [],
      returns: [],
      customer: null,
      user: null,
      register: null,
    };
    prisma.posSale.findUnique.mockResolvedValue(existing);

    const result = await service.createSale(baseDto, actor, 'key-1');
    expect(result.id).toBe('sale-1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects missing customer', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.createSale({ ...baseDto, customerId: 'missing' }, actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
