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
    $transaction: jest.fn(),
  };

  const service = new AccountingService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips duplicate accounting references', async () => {
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
});
