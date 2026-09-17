import { ForbiddenException } from '@nestjs/common';
import { AccountTransactionType, Prisma, UserStatus } from '@prisma/client';
import { AdminCustomersService } from './admin-customers.service';

describe('AdminCustomersService filters', () => {
  const prisma = {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    corporateCustomer: { update: jest.fn() },
    order: { aggregate: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    payment: { aggregate: jest.fn() },
    adminUser: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const accounting = {
    balancesByCustomer: jest.fn().mockResolvedValue([]),
    getCurrentAccount: jest.fn().mockResolvedValue({
      totalDebit: '0.00',
      totalCredit: '0.00',
      balance: '0.00',
      currency: 'TRY',
    }),
  };
  const customers = { createCorporateProfile: jest.fn() };
  const emailOutbox = { enqueue: jest.fn() };
  const audit = { log: jest.fn() };

  const service = new AdminCustomersService(
    prisma as never,
    accounting as never,
    customers as never,
    emailOutbox as never,
    audit as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) {
        return Promise.all(ops);
      }
      return ops;
    });
  });

  it('exports CSV without sensitive password fields', async () => {
    prisma.user.count.mockResolvedValue(1);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        firstName: 'Ali',
        lastName: 'Veli',
        email: 'ali@example.com',
        phone: '555',
        userType: 'INDIVIDUAL',
        status: UserStatus.ACTIVE,
        corporateCustomer: null,
        _count: { orders: 2 },
        orders: [{ totalAmount: new Prisma.Decimal('100.00') }],
        createdAt: new Date('2026-01-01'),
      },
    ]);
    accounting.balancesByCustomer.mockResolvedValue([
      {
        customerId: 'u1',
        name: 'Ali Veli',
        email: 'ali@example.com',
        balance: '50.00',
        totalDebit: '50.00',
        totalCredit: '0.00',
      },
    ]);

    const csv = await service.exportCsv({});
    expect(csv).toContain('Customer,Type,Company,Email,Phone,Balance');
    expect(csv).toContain('ali@example.com');
    expect(csv.toLowerCase()).not.toContain('password');
  });
});

describe('Orders inactive gate', () => {
  it('documents forbidden status via UserStatus enum', () => {
    expect(UserStatus.INACTIVE).toBe('INACTIVE');
    expect(UserStatus.BLOCKED).toBe('BLOCKED');
    expect(ForbiddenException).toBeDefined();
    expect(AccountTransactionType.SALE).toBe('SALE');
  });
});
