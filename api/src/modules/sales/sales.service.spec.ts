import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, SalePaymentMethod, SaleStatus } from '@prisma/client';
import { SalesService } from './sales.service';

function money(v: string) {
  return new Prisma.Decimal(v);
}

describe('SalesService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
    sale: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    saleNumberSequence: { upsert: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const inventory = {
    sellAvailableInTransaction: jest.fn(),
    commitReturnInTransaction: jest.fn(),
  };

  const prices = {
    resolvePrice: jest.fn(),
  };

  const audit = { log: jest.fn() };

  const config = {
    get: jest.fn().mockReturnValue('Europe/Istanbul'),
  };

  const service = new SalesService(
    prisma as never,
    inventory as never,
    prices as never,
    audit as never,
    config as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects create with empty items', async () => {
    await expect(
      service.create(
        { items: [], paymentMethod: SalePaymentMethod.CASH },
        'admin1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates retail sale with null customerId and stocks out', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Ürün', sku: 'SKU1', vatRate: 20 },
    ]);
    prices.resolvePrice.mockResolvedValue({
      amount: '100.00',
      currency: 'TRY',
    });

    const createdSale = {
      id: 's1',
      saleNumber: 'PS-20260918-00001',
      customerId: null,
      createdById: 'admin1',
      status: SaleStatus.COMPLETED,
      paymentMethod: SalePaymentMethod.CASH,
      currency: 'TRY',
      subtotal: money('83.33'),
      discountAmount: money('0.00'),
      taxAmount: money('16.67'),
      totalAmount: money('100.00'),
      note: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date('2026-09-18T10:00:00Z'),
      customer: null,
      createdBy: {
        id: 'admin1',
        firstName: 'Murat',
        lastName: 'Balcı',
        email: 'a@x.com',
      },
      items: [
        {
          id: 'si1',
          productId: 'p1',
          productName: 'Ürün',
          sku: 'SKU1',
          quantity: 1,
          unitPrice: money('100.00'),
          discountAmount: money('0.00'),
          taxRate: money('20.00'),
          taxAmount: money('16.67'),
          lineSubtotal: money('83.33'),
          lineTotal: money('100.00'),
        },
      ],
    };

    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          sale: {
            create: jest.fn().mockResolvedValue(createdSale),
          },
          saleNumberSequence: { upsert: jest.fn() },
          $queryRaw: jest.fn().mockResolvedValue([{ lastValue: 1 }]),
        };
        return fn(tx);
      },
    );

    inventory.sellAvailableInTransaction.mockResolvedValue({});

    const result = await service.create(
      {
        customerId: null,
        items: [{ productId: 'p1', quantity: 1 }],
        paymentMethod: SalePaymentMethod.CASH,
      },
      'admin1',
    );

    expect(result.customerId).toBeNull();
    expect(result.customerLabel).toBe('Perakende Satış');
    expect(result.createdBy.firstName).toBe('Murat');
    expect(inventory.sellAvailableInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      'p1',
      1,
      expect.objectContaining({
        referenceType: 'SALE',
        createdBy: 'admin1',
      }),
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('creates sale with customer when customerId provided', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'c1',
      userType: 'INDIVIDUAL',
      status: 'ACTIVE',
    });
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Ürün', sku: 'SKU1', vatRate: 20 },
    ]);
    prices.resolvePrice.mockResolvedValue({
      amount: '50.00',
      currency: 'TRY',
    });

    const createdSale = {
      id: 's2',
      saleNumber: 'PS-20260918-00002',
      customerId: 'c1',
      createdById: 'admin1',
      status: SaleStatus.COMPLETED,
      paymentMethod: SalePaymentMethod.CREDIT_CARD,
      currency: 'TRY',
      subtotal: money('41.67'),
      discountAmount: money('0.00'),
      taxAmount: money('8.33'),
      totalAmount: money('50.00'),
      note: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date('2026-09-18T11:00:00Z'),
      customer: {
        id: 'c1',
        firstName: 'Ahmet',
        lastName: 'Yılmaz',
        email: 'a@y.com',
      },
      createdBy: {
        id: 'admin1',
        firstName: 'Murat',
        lastName: 'Balcı',
        email: 'a@x.com',
      },
      items: [
        {
          id: 'si2',
          productId: 'p1',
          productName: 'Ürün',
          sku: 'SKU1',
          quantity: 1,
          unitPrice: money('50.00'),
          discountAmount: money('0.00'),
          taxRate: money('20.00'),
          taxAmount: money('8.33'),
          lineSubtotal: money('41.67'),
          lineTotal: money('50.00'),
        },
      ],
    };

    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          sale: { create: jest.fn().mockResolvedValue(createdSale) },
          saleNumberSequence: { upsert: jest.fn() },
          $queryRaw: jest.fn().mockResolvedValue([{ lastValue: 2 }]),
        };
        return fn(tx);
      },
    );
    inventory.sellAvailableInTransaction.mockResolvedValue({});

    const result = await service.create(
      {
        customerId: 'c1',
        items: [{ productId: 'p1', quantity: 1 }],
        paymentMethod: SalePaymentMethod.CREDIT_CARD,
      },
      'admin1',
    );

    expect(result.customerId).toBe('c1');
    expect(result.customerLabel).toBe('Ahmet Yılmaz');
    expect(prices.resolvePrice).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ customerId: 'c1' }),
    );
  });

  it('does not create sale when stock is insufficient', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Ürün', sku: 'SKU1', vatRate: 20 },
    ]);
    prices.resolvePrice.mockResolvedValue({
      amount: '100.00',
      currency: 'TRY',
    });
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          sale: {
            create: jest.fn().mockResolvedValue({
              id: 's3',
              saleNumber: 'PS-20260918-00003',
              customerId: null,
              items: [{ id: 'si3', productId: 'p1', quantity: 5 }],
            }),
          },
          saleNumberSequence: { upsert: jest.fn() },
          $queryRaw: jest.fn().mockResolvedValue([{ lastValue: 3 }]),
        };
        return fn(tx);
      },
    );
    inventory.sellAvailableInTransaction.mockRejectedValue(
      new ConflictException('Insufficient stock'),
    );

    await expect(
      service.create(
        {
          customerId: null,
          items: [{ productId: 'p1', quantity: 5 }],
          paymentMethod: SalePaymentMethod.CASH,
        },
        'admin1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('daily summary counts retail and customer sales in total', async () => {
    prisma.sale.findMany
      .mockResolvedValueOnce([
        {
          customerId: null,
          paymentMethod: SalePaymentMethod.CASH,
          totalAmount: money('75.00'),
          items: [{ quantity: 2 }],
        },
        {
          customerId: 'c1',
          paymentMethod: SalePaymentMethod.CREDIT_CARD,
          totalAmount: money('50.00'),
          items: [{ quantity: 1 }],
        },
      ])
      .mockResolvedValueOnce([]);

    const summary = await service.dailySummary('2026-09-18');
    expect(summary.saleCount).toBe(2);
    expect(summary.retailSaleCount).toBe(1);
    expect(summary.customerSaleCount).toBe(1);
    expect(summary.itemCount).toBe(3);
    expect(summary.totalSales).toBe('125.00');
    expect(summary.paymentBreakdown.cash).toBe('75.00');
    expect(summary.paymentBreakdown.card).toBe('50.00');
  });

  it('filters retail sales when customerId=retail', async () => {
    prisma.sale.count.mockResolvedValue(0);
    prisma.sale.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    });

    await service.list({ customerId: 'retail', page: 1, limit: 50 });

    expect(prisma.sale.count).toHaveBeenCalledWith({
      where: { customerId: null },
    });
    expect(prisma.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: null },
      }),
    );
  });
});
