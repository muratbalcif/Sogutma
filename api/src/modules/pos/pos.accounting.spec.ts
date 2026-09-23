import { BadRequestException } from '@nestjs/common';
import {
  AccountTransactionType,
  PosPaymentMethod,
  PosSaleStatus,
  Prisma,
} from '@prisma/client';
import { PosService } from './pos.service';

function money(v: string) {
  return new Prisma.Decimal(v);
}

/**
 * Phase 2 — POS → AccountTransaction integration.
 * Uses real AccountingService reference conventions:
 *   SALE:POS:{saleId} (DEBIT), PAYMENT:POS:{paymentId} (CREDIT).
 */
describe('PosService accounting (Phase 2)', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
    posRegister: { findUnique: jest.fn(), findMany: jest.fn() },
    posSale: { create: jest.fn(), findUnique: jest.fn() },
    posSaleNumberSequence: { upsert: jest.fn() },
    $transaction: jest.fn(),
  };

  const inventory = {
    sellAvailableInTransaction: jest.fn().mockResolvedValue({}),
  };

  const prices = {
    resolvePrice: jest.fn().mockResolvedValue({
      amount: '100.00',
      currency: 'TRY',
    }),
  };

  const accounting = {
    assertCreditLimitAllows: jest.fn().mockResolvedValue(undefined),
    recordIfAbsent: jest.fn().mockResolvedValue({
      created: true,
      balanceAfter: '0.00',
    }),
    getCurrentAccount: jest.fn().mockResolvedValue({
      balance: '0.00',
      currency: 'TRY',
      creditLimit: '50000.00',
      allowCredit: true,
    }),
  };

  const audit = { log: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('Europe/Istanbul') };

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
    userType: 'CORPORATE' as const,
    status: 'ACTIVE' as const,
    roles: ['POS_CASHIER'],
    permissions: ['pos.sell', 'pos.read', 'pos.discount'],
  };

  function mockProduct() {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Ürün',
        sku: 'SKU1',
        barcode: null,
        vatRate: 20,
      },
    ]);
  }

  function buildCreated(opts: {
    customerId: string | null;
    payments: Array<{
      id: string;
      method: PosPaymentMethod;
      amount: string;
    }>;
    grandTotal?: string;
  }) {
    const grand = opts.grandTotal ?? '200.00';
    return {
      id: 'sale-1',
      saleNumber: 'POS-20260923-000001',
      registerId: 'reg-1',
      userId: 'cashier-1',
      customerId: opts.customerId,
      status: PosSaleStatus.COMPLETED,
      currency: 'TRY',
      subtotal: money('166.67'),
      discountTotal: money('0.00'),
      taxTotal: money('33.33'),
      grandTotal: money(grand),
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
          barcode: null,
          quantity: 2,
          unitPrice: money('100.00'),
          discountAmount: money('0.00'),
          taxRate: money('20.00'),
          taxAmount: money('33.33'),
          lineSubtotal: money('166.67'),
          lineTotal: money(grand),
          createdAt: new Date(),
        },
      ],
      payments: opts.payments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: money(p.amount),
        status: 'COMPLETED',
        referenceNumber: null,
        createdAt: new Date(),
      })),
      returns: [],
      customer: opts.customerId
        ? {
            id: opts.customerId,
            firstName: 'Cari',
            lastName: 'Müşteri',
            email: 'c@test.com',
          }
        : null,
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
  }

  function mockTxn(created: ReturnType<typeof buildCreated>) {
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
      const tx = {
        posSale: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(created),
        },
        posSaleNumberSequence: { upsert: jest.fn() },
        $queryRaw: jest.fn().mockResolvedValue([{ lastValue: 1 }]),
        corporateCustomer: { findUnique: jest.fn() },
        accountTransaction: {
          findUnique: jest.fn(),
          create: jest.fn(),
          groupBy: jest.fn(),
        },
        $executeRaw: jest.fn(),
      };
      return Promise.resolve(fn(tx));
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.posSale.findUnique.mockResolvedValue(null);
    prisma.posRegister.findUnique.mockResolvedValue({
      id: 'reg-1',
      name: 'Kasa 1',
      code: 'KASA1',
      isActive: true,
    });
    mockProduct();
    accounting.assertCreditLimitAllows.mockResolvedValue(undefined);
    accounting.recordIfAbsent.mockResolvedValue({
      created: true,
      balanceAfter: '0.00',
    });
    accounting.getCurrentAccount.mockResolvedValue({
      balance: '0.00',
      currency: 'TRY',
      creditLimit: '50000.00',
      allowCredit: true,
    });
  });

  async function sellWithCustomer(
    method: PosPaymentMethod,
    paymentId = 'pay-1',
  ) {
    prisma.user.findUnique.mockResolvedValue({
      id: 'cust-1',
      userType: 'CORPORATE',
      status: 'ACTIVE',
      corporateCustomer: { allowCredit: true },
    });
    const created = buildCreated({
      customerId: 'cust-1',
      payments: [{ id: paymentId, method, amount: '200.00' }],
    });
    mockTxn(created);
    return service.createSale(
      {
        registerId: 'reg-1',
        customerId: 'cust-1',
        items: [{ productId: 'p1', quantity: 2 }],
        payments: [{ method, amount: 200 }],
      },
      actor,
    );
  }

  it('CASH with customer → SALE debit + PAYMENT credit', async () => {
    await sellWithCustomer(PosPaymentMethod.CASH);
    expect(accounting.recordIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AccountTransactionType.SALE,
        reference: 'SALE:POS:sale-1',
        referenceType: 'POS_SALE',
        amount: money('200.00'),
      }),
    );
    expect(accounting.recordIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AccountTransactionType.PAYMENT,
        reference: 'PAYMENT:POS:pay-1',
        referenceType: 'POS_PAYMENT',
        amount: money('200.00'),
      }),
    );
    expect(accounting.assertCreditLimitAllows).not.toHaveBeenCalled();
  });

  it('CARD with customer → DEBIT + CREDIT', async () => {
    await sellWithCustomer(PosPaymentMethod.CARD, 'pay-card');
    expect(accounting.recordIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AccountTransactionType.PAYMENT,
        reference: 'PAYMENT:POS:pay-card',
      }),
    );
  });

  it('BANK_TRANSFER with customer → DEBIT + CREDIT', async () => {
    await sellWithCustomer(PosPaymentMethod.BANK_TRANSFER, 'pay-bt');
    expect(accounting.recordIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AccountTransactionType.PAYMENT,
        reference: 'PAYMENT:POS:pay-bt',
      }),
    );
  });

  it('ON_ACCOUNT → DEBIT only (no CREDIT)', async () => {
    await sellWithCustomer(PosPaymentMethod.ON_ACCOUNT, 'pay-oa');
    const types = accounting.recordIfAbsent.mock.calls.map(
      (c: [{ type: AccountTransactionType }]) => c[0].type,
    );
    expect(types).toEqual([AccountTransactionType.SALE]);
    expect(accounting.assertCreditLimitAllows).toHaveBeenCalledWith(
      'cust-1',
      money('200.00'),
      expect.anything(),
    );
  });

  it('ON_ACCOUNT without customer → fail', async () => {
    await expect(
      service.createSale(
        {
          registerId: 'reg-1',
          items: [{ productId: 'p1', quantity: 2 }],
          payments: [{ method: PosPaymentMethod.ON_ACCOUNT, amount: 200 }],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accounting.recordIfAbsent).not.toHaveBeenCalled();
  });

  it('credit limit exceeded → fail', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'cust-1',
      userType: 'CORPORATE',
      status: 'ACTIVE',
      corporateCustomer: { allowCredit: true },
    });
    accounting.assertCreditLimitAllows.mockRejectedValue(
      new BadRequestException('Credit limit exceeded'),
    );
    const created = buildCreated({
      customerId: 'cust-1',
      payments: [
        { id: 'pay-oa', method: PosPaymentMethod.ON_ACCOUNT, amount: '200.00' },
      ],
    });
    mockTxn(created);

    await expect(
      service.createSale(
        {
          registerId: 'reg-1',
          customerId: 'cust-1',
          items: [{ productId: 'p1', quantity: 2 }],
          payments: [{ method: PosPaymentMethod.ON_ACCOUNT, amount: 200 }],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exact credit limit → success (assert passes)', async () => {
    await sellWithCustomer(PosPaymentMethod.ON_ACCOUNT);
    expect(accounting.assertCreditLimitAllows).toHaveBeenCalled();
    expect(accounting.recordIfAbsent).toHaveBeenCalled();
  });

  it('split payment → one DEBIT + multiple CREDIT', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'cust-1',
      userType: 'CORPORATE',
      status: 'ACTIVE',
      corporateCustomer: { allowCredit: true },
    });
    const created = buildCreated({
      customerId: 'cust-1',
      grandTotal: '200.00',
      payments: [
        { id: 'pay-c', method: PosPaymentMethod.CASH, amount: '120.00' },
        { id: 'pay-k', method: PosPaymentMethod.CARD, amount: '80.00' },
      ],
    });
    mockTxn(created);

    await service.createSale(
      {
        registerId: 'reg-1',
        customerId: 'cust-1',
        items: [{ productId: 'p1', quantity: 2 }],
        payments: [
          { method: PosPaymentMethod.CASH, amount: 120 },
          { method: PosPaymentMethod.CARD, amount: 80 },
        ],
      },
      actor,
    );

    const refs = accounting.recordIfAbsent.mock.calls.map(
      (c: [{ reference: string }]) => c[0].reference,
    );
    expect(refs).toEqual([
      'SALE:POS:sale-1',
      'PAYMENT:POS:pay-c',
      'PAYMENT:POS:pay-k',
    ]);
  });

  it('walk-in CASH (no customer) → no accounting ledger', async () => {
    const created = buildCreated({
      customerId: null,
      payments: [
        { id: 'pay-1', method: PosPaymentMethod.CASH, amount: '200.00' },
      ],
    });
    mockTxn(created);

    await service.createSale(
      {
        registerId: 'reg-1',
        items: [{ productId: 'p1', quantity: 2 }],
        payments: [{ method: PosPaymentMethod.CASH, amount: 200 }],
      },
      actor,
    );

    expect(accounting.recordIfAbsent).not.toHaveBeenCalled();
    expect(inventory.sellAvailableInTransaction).toHaveBeenCalled();
  });

  it('duplicate Idempotency-Key → no second accounting', async () => {
    const existing = buildCreated({
      customerId: 'cust-1',
      payments: [
        { id: 'pay-1', method: PosPaymentMethod.CASH, amount: '200.00' },
      ],
    });
    prisma.posSale.findUnique.mockResolvedValue(existing);

    await service.createSale(
      {
        registerId: 'reg-1',
        customerId: 'cust-1',
        items: [{ productId: 'p1', quantity: 2 }],
        payments: [{ method: PosPaymentMethod.CASH, amount: 200 }],
      },
      actor,
      'idem-1',
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(accounting.recordIfAbsent).not.toHaveBeenCalled();
  });

  it('recordIfAbsent created:false (duplicate reference) still completes sale', async () => {
    accounting.recordIfAbsent.mockResolvedValue({ created: false });
    await sellWithCustomer(PosPaymentMethod.CASH);
    expect(accounting.recordIfAbsent).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalled();
  });

  it('transaction failure rolls back before audit', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'cust-1',
      userType: 'CORPORATE',
      status: 'ACTIVE',
      corporateCustomer: { allowCredit: true },
    });
    prisma.$transaction.mockRejectedValue(new Error('boom'));

    await expect(
      service.createSale(
        {
          registerId: 'reg-1',
          customerId: 'cust-1',
          items: [{ productId: 'p1', quantity: 2 }],
          payments: [{ method: PosPaymentMethod.CASH, amount: 200 }],
        },
        actor,
      ),
    ).rejects.toThrow('boom');
    expect(audit.log).not.toHaveBeenCalled();
  });
});
