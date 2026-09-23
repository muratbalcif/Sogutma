import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PosPaymentMethod, PosSaleStatus, Prisma } from '@prisma/client';
import { PosReturnService } from './pos-return.service';

function money(v: string) {
  return new Prisma.Decimal(v);
}

describe('PosReturnService', () => {
  const prisma = {
    posReturn: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    posSale: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    posPayment: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const inventory = {
    commitReturnInTransaction: jest.fn().mockResolvedValue({}),
  };

  const accounting = {
    recordIfAbsent: jest.fn().mockResolvedValue({ created: true }),
  };

  const audit = { log: jest.fn() };

  const service = new PosReturnService(
    prisma as never,
    inventory as never,
    accounting as never,
    audit as never,
  );

  const cashier = {
    id: 'cashier-1',
    email: 'c@t.com',
    firstName: 'Kas',
    lastName: 'İyer',
    phone: null,
    userType: 'INDIVIDUAL' as const,
    status: 'ACTIVE' as const,
    roles: ['POS_CASHIER'],
    permissions: ['pos.read', 'pos.sell', 'pos.refund'],
  };

  const noRefund = {
    ...cashier,
    permissions: ['pos.read', 'pos.sell'],
  };

  function baseSale(
    overrides?: Partial<{
      status: PosSaleStatus;
      customerId: string | null;
      returns: unknown[];
    }>,
  ) {
    return {
      id: 'sale-1',
      saleNumber: 'POS-20260923-000001',
      status: overrides?.status ?? PosSaleStatus.COMPLETED,
      currency: 'TRY',
      customerId: overrides?.customerId ?? null,
      grandTotal: money('200.00'),
      items: [
        {
          id: 'item-1',
          productId: 'p1',
          productName: 'Cola',
          sku: 'COLA',
          quantity: 5,
          lineTotal: money('100.00'),
        },
        {
          id: 'item-2',
          productId: 'p2',
          productName: 'Ekmek',
          sku: 'EKM',
          quantity: 2,
          lineTotal: money('100.00'),
        },
      ],
      payments: [
        {
          id: 'pay-1',
          method: PosPaymentMethod.CASH,
          amount: money('200.00'),
        },
      ],
      returns: overrides?.returns ?? [],
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.posReturn.findUnique.mockResolvedValue(null);
  });

  it('rejects unauthorized return', async () => {
    await expect(
      service.createReturn(
        'sale-1',
        { items: [{ saleItemId: 'item-1', quantity: 1 }] },
        noRefund,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects zero quantity', async () => {
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => {
        const tx = {
          $executeRaw: jest.fn(),
          posReturn: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
          posSale: {
            findUnique: jest.fn().mockResolvedValue(baseSale()),
            update: jest.fn(),
          },
          posPayment: { update: jest.fn() },
        };
        return Promise.resolve(fn(tx));
      },
    );
    await expect(
      service.createReturn(
        'sale-1',
        { items: [{ saleItemId: 'item-1', quantity: 0 }] },
        cashier,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects over-return', async () => {
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => {
        const tx = {
          $executeRaw: jest.fn(),
          posReturn: { findUnique: jest.fn().mockResolvedValue(null) },
          posSale: {
            findUnique: jest.fn().mockResolvedValue(baseSale()),
            update: jest.fn(),
          },
          posPayment: { update: jest.fn() },
        };
        return Promise.resolve(fn(tx));
      },
    );
    await expect(
      service.createReturn(
        'sale-1',
        { items: [{ saleItemId: 'item-1', quantity: 99 }] },
        cashier,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('partial return restocks and does not set REFUNDED', async () => {
    const created = {
      id: 'ret-1',
      saleId: 'sale-1',
      userId: 'cashier-1',
      currency: 'TRY',
      totalAmount: money('20.00'),
      reason: null,
      note: null,
      createdAt: new Date(),
      items: [
        {
          id: 'ri-1',
          saleItemId: 'item-1',
          productId: 'p1',
          productName: 'Cola',
          sku: 'COLA',
          quantity: 1,
          lineRefund: money('20.00'),
        },
      ],
      payments: [
        { id: 'rp-1', method: PosPaymentMethod.CASH, amount: money('20.00') },
      ],
      sale: {
        id: 'sale-1',
        saleNumber: 'POS-20260923-000001',
        status: PosSaleStatus.COMPLETED,
      },
    };

    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => {
        const tx = {
          $executeRaw: jest.fn(),
          posReturn: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(created),
          },
          posSale: {
            findUnique: jest.fn().mockResolvedValue(baseSale()),
            update: jest.fn(),
          },
          posPayment: { update: jest.fn() },
        };
        return Promise.resolve(fn(tx));
      },
    );

    const result = await service.createReturn(
      'sale-1',
      { items: [{ saleItemId: 'item-1', quantity: 1 }] },
      cashier,
      'idem-1',
    );

    expect(result.totalAmount).toBe('20.00');
    expect(inventory.commitReturnInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      'p1',
      1,
      expect.objectContaining({
        referenceType: 'POS_SALE',
        referenceId: 'ri-1',
      }),
    );
    expect(result.saleStatus).toBe(PosSaleStatus.COMPLETED);
  });

  it('full return sets REFUNDED and posts accounting for customer', async () => {
    const created = {
      id: 'ret-full',
      saleId: 'sale-1',
      userId: 'cashier-1',
      currency: 'TRY',
      totalAmount: money('200.00'),
      reason: null,
      note: null,
      createdAt: new Date(),
      items: [
        {
          id: 'ri-1',
          saleItemId: 'item-1',
          productId: 'p1',
          productName: 'Cola',
          sku: 'COLA',
          quantity: 5,
          lineRefund: money('100.00'),
        },
        {
          id: 'ri-2',
          saleItemId: 'item-2',
          productId: 'p2',
          productName: 'Ekmek',
          sku: 'EKM',
          quantity: 2,
          lineRefund: money('100.00'),
        },
      ],
      payments: [
        {
          id: 'rp-1',
          method: PosPaymentMethod.CASH,
          amount: money('200.00'),
        },
      ],
      sale: {
        id: 'sale-1',
        saleNumber: 'POS-20260923-000001',
        status: PosSaleStatus.COMPLETED,
      },
    };

    const saleUpdate = jest.fn();
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => {
        const tx = {
          $executeRaw: jest.fn(),
          posReturn: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(created),
          },
          posSale: {
            findUnique: jest
              .fn()
              .mockResolvedValue(baseSale({ customerId: 'cust-1' })),
            update: saleUpdate,
          },
          posPayment: { update: jest.fn() },
        };
        return Promise.resolve(fn(tx));
      },
    );

    await service.createReturn(
      'sale-1',
      {
        items: [
          { saleItemId: 'item-1', quantity: 5 },
          { saleItemId: 'item-2', quantity: 2 },
        ],
      },
      cashier,
    );

    expect(saleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PosSaleStatus.REFUNDED },
      }),
    );
    expect(accounting.recordIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'REVERSAL:POS_RETURN:ret-full',
        type: 'PAYMENT',
      }),
    );
    expect(accounting.recordIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'REFUND:POS:rp-1',
        type: 'REFUND',
      }),
    );
  });

  it('idempotency key returns existing', async () => {
    prisma.posReturn.findUnique.mockResolvedValue({
      id: 'ret-1',
      saleId: 'sale-1',
      userId: 'cashier-1',
      currency: 'TRY',
      totalAmount: money('20.00'),
      reason: null,
      note: null,
      createdAt: new Date(),
      items: [],
      payments: [],
      sale: {
        saleNumber: 'POS-20260923-000001',
        status: PosSaleStatus.COMPLETED,
      },
    });

    const result = await service.createReturn(
      'sale-1',
      { items: [{ saleItemId: 'item-1', quantity: 1 }] },
      cashier,
      'same-key',
    );
    expect(result.id).toBe('ret-1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects second full return', async () => {
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => {
        const tx = {
          $executeRaw: jest.fn(),
          posReturn: { findUnique: jest.fn().mockResolvedValue(null) },
          posSale: {
            findUnique: jest
              .fn()
              .mockResolvedValue(baseSale({ status: PosSaleStatus.REFUNDED })),
            update: jest.fn(),
          },
          posPayment: { update: jest.fn() },
        };
        return Promise.resolve(fn(tx));
      },
    );

    await expect(
      service.createReturn(
        'sale-1',
        { items: [{ saleItemId: 'item-1', quantity: 1 }] },
        cashier,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('missing sale → 404', async () => {
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => {
        const tx = {
          $executeRaw: jest.fn(),
          posReturn: { findUnique: jest.fn().mockResolvedValue(null) },
          posSale: {
            findUnique: jest.fn().mockResolvedValue(null),
            update: jest.fn(),
          },
          posPayment: { update: jest.fn() },
        };
        return Promise.resolve(fn(tx));
      },
    );
    await expect(
      service.createReturn(
        'missing',
        { items: [{ saleItemId: 'item-1', quantity: 1 }] },
        cashier,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
