import { BadRequestException } from '@nestjs/common';
import { PosPaymentMethod, Prisma } from '@prisma/client';
import { PosReportsService } from './pos-reports.service';

describe('PosReportsService', () => {
  const prisma = {
    posSale: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    posSaleItem: {
      aggregate: jest.fn(),
    },
    posReturn: {
      aggregate: jest.fn(),
    },
    posPayment: {
      groupBy: jest.fn(),
    },
    posRegister: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  const service = new PosReportsService(prisma as never);

  function mockEmpty() {
    prisma.posSale.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _sum: { grandTotal: null },
    });
    prisma.posSaleItem.aggregate.mockResolvedValue({
      _sum: { quantity: null },
    });
    prisma.posReturn.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _sum: { totalAmount: null },
    });
    prisma.posPayment.groupBy.mockResolvedValue([]);
    prisma.posSale.groupBy.mockResolvedValue([]);
    prisma.posRegister.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('summary empty', async () => {
    mockEmpty();
    const result = await service.summary({
      from: '2026-09-01',
      to: '2026-09-02',
    });

    expect(result.totalSales).toBe(0);
    expect(result.grossSales).toBe('0.00');
    expect(result.returns).toBe('0.00');
    expect(result.netSales).toBe('0.00');
    expect(result.averageBasket).toBe('0.00');
    expect(result.paymentBreakdown).toHaveLength(4);
  });

  it('aggregates sales, payments, registers, cashiers', async () => {
    prisma.posSale.aggregate.mockResolvedValue({
      _count: { _all: 2 },
      _sum: { grandTotal: new Prisma.Decimal('300.00') },
    });
    prisma.posSaleItem.aggregate.mockResolvedValue({
      _sum: { quantity: 10 },
    });
    prisma.posReturn.aggregate.mockResolvedValue({
      _count: { _all: 1 },
      _sum: { totalAmount: new Prisma.Decimal('50.00') },
    });
    prisma.posPayment.groupBy.mockResolvedValue([
      {
        method: PosPaymentMethod.CASH,
        _count: { _all: 1 },
        _sum: { amount: new Prisma.Decimal('200.00') },
      },
      {
        method: PosPaymentMethod.CARD,
        _count: { _all: 1 },
        _sum: { amount: new Prisma.Decimal('100.00') },
      },
    ]);
    prisma.posSale.groupBy
      .mockResolvedValueOnce([
        {
          registerId: 'r1',
          _count: { _all: 2 },
          _sum: { grandTotal: new Prisma.Decimal('300.00') },
        },
      ])
      .mockResolvedValueOnce([
        {
          userId: 'u1',
          _count: { _all: 2 },
          _sum: { grandTotal: new Prisma.Decimal('300.00') },
        },
      ]);
    prisma.posRegister.findMany.mockResolvedValue([
      { id: 'r1', code: 'KASA1', name: 'Kasa 1' },
    ]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        firstName: 'Murat',
        lastName: 'B',
        email: 'm@t.com',
      },
    ]);

    const result = await service.summary({
      from: '2026-09-01',
      to: '2026-09-24',
      registerId: 'r1',
      cashierId: 'u1',
    });

    expect(result.totalSales).toBe(2);
    expect(result.grossSales).toBe('300.00');
    expect(result.returns).toBe('50.00');
    expect(result.netSales).toBe('250.00');
    expect(result.totalItems).toBe(10);
    expect(result.averageBasket).toBe('150.00');
    expect(
      result.paymentBreakdown.find((p) => p.method === PosPaymentMethod.CASH)
        ?.amount,
    ).toBe('200.00');
    expect(result.registerBreakdown[0]?.revenue).toBe('300.00');
    expect(result.cashierBreakdown[0]?.cashierName).toContain('Murat');
  });

  it('rejects invalid date range', async () => {
    await expect(
      service.summary({ from: '2026-09-10', to: '2026-09-10' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('x report does not mutate and returns generatedAt', async () => {
    mockEmpty();
    const x = await service.xReport({});
    expect(x.generatedAt).toBeTruthy();
    expect(prisma.posSale.findMany).not.toHaveBeenCalled();
  });
});
