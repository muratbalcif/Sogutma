import { AccountTransactionType, Prisma } from '@prisma/client';
import { AccountingService } from './accounting.service';

describe('AccountingService', () => {
  const prisma = {
    accountTransaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    corporateCustomer: {
      findUnique: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  };

  const audit = { log: jest.fn() };
  const service = new AccountingService(prisma as never, audit as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.corporateCustomer.findUnique.mockResolvedValue(null);
    prisma.order.findMany.mockResolvedValue([]);
  });

  it('skips duplicate accounting references', async () => {
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      Promise.resolve(
        fn({
          accountTransaction: prisma.accountTransaction,
          $executeRaw: prisma.$executeRaw,
        }),
      ),
    );
    prisma.accountTransaction.findUnique.mockResolvedValue({ id: 'existing' });
    const result = await service.recordIfAbsent({
      userId: 'u1',
      type: AccountTransactionType.PAYMENT,
      amount: '100.00',
      currency: 'TRY',
      description: 'Payment',
      reference: 'PAYMENT:p1',
    });
    expect(result.created).toBe(false);
    expect(prisma.accountTransaction.create).not.toHaveBeenCalled();
  });

  it('creates SALE debit and PAYMENT credit for current account', async () => {
    prisma.accountTransaction.groupBy.mockResolvedValue([
      {
        type: AccountTransactionType.SALE,
        _sum: { amount: new Prisma.Decimal('1000.00') },
      },
      {
        type: AccountTransactionType.PAYMENT,
        _sum: { amount: new Prisma.Decimal('700.00') },
      },
    ]);

    const account = await service.getCurrentAccount('u1');
    expect(account.totalDebit).toBe('1000.00');
    expect(account.totalCredit).toBe('700.00');
    expect(account.balance).toBe('300.00');
  });

  it('preserves Decimal precision in sum helper', () => {
    expect(service.sumAmounts(['10.10', '20.20'])).toBe('30.30');
  });

  it('rejects credit limit breach for allowCredit customers', async () => {
    prisma.corporateCustomer.findUnique.mockResolvedValue({
      allowCredit: true,
      creditLimit: new Prisma.Decimal('50000'),
    });
    prisma.accountTransaction.groupBy.mockResolvedValue([
      {
        type: AccountTransactionType.SALE,
        _sum: { amount: new Prisma.Decimal('45000') },
      },
    ]);

    await expect(
      service.assertCreditLimitAllows('u1', '10000'),
    ).rejects.toThrow(/Credit limit exceeded/);

    await expect(
      service.assertCreditLimitAllows('u1', '5000'),
    ).resolves.toBeUndefined();
  });

  it('skips credit limit when allowCredit is false', async () => {
    prisma.corporateCustomer.findUnique.mockResolvedValue({
      allowCredit: false,
      creditLimit: new Prisma.Decimal('1'),
    });
    await expect(
      service.assertCreditLimitAllows('u1', '99999'),
    ).resolves.toBeUndefined();
  });
});
