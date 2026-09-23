import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PosPaymentMethod, PosSaleStatus, Prisma } from '@prisma/client';
import { PosAdminService } from './pos-admin.service';

describe('PosAdminService', () => {
  const prisma = {
    posRegister: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    posSale: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    posReturn: {
      findMany: jest.fn(),
    },
    accountTransaction: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const posService = {
    getSaleById: jest.fn(),
  };

  const audit = { log: jest.fn() };

  const service = new PosAdminService(
    prisma as never,
    posService as never,
    audit as never,
  );

  const admin = {
    id: 'admin1',
    email: 'a@t.com',
    firstName: 'Admin',
    lastName: 'User',
    phone: null,
    userType: 'INDIVIDUAL' as const,
    status: 'ACTIVE' as const,
    roles: ['SUPER_ADMIN'],
    permissions: [] as string[],
  };

  const cashier = {
    id: 'cashier-1',
    email: 'c@t.com',
    firstName: 'Kas',
    lastName: 'İyer',
    phone: null,
    userType: 'INDIVIDUAL' as const,
    status: 'ACTIVE' as const,
    roles: ['POS_CASHIER'],
    permissions: ['pos.read', 'pos.sell'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.posReturn.findMany.mockResolvedValue([]);
  });

  it('creates register', async () => {
    prisma.posRegister.create.mockResolvedValue({
      id: 'r1',
      name: 'Kasa 2',
      code: 'KASA2',
      isActive: true,
      openedAt: null,
      closedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const row = await service.createRegister(
      { name: 'Kasa 2', code: 'kasa2' },
      'admin1',
    );
    expect(row.code).toBe('KASA2');
    expect(audit.log).toHaveBeenCalled();
  });

  it('rejects duplicate register code', async () => {
    prisma.posRegister.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.createRegister({ name: 'X', code: 'KASA1' }, 'admin1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates register active flag', async () => {
    prisma.posRegister.findUnique.mockResolvedValue({
      id: 'r1',
      name: 'Kasa 1',
      code: 'KASA1',
      isActive: true,
    });
    prisma.posRegister.update.mockResolvedValue({
      id: 'r1',
      name: 'Kasa 1',
      code: 'KASA1',
      isActive: false,
      openedAt: null,
      closedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const row = await service.updateRegister(
      'r1',
      { isActive: false },
      'admin1',
    );
    expect(row.isActive).toBe(false);
  });

  it('update missing register → 404', async () => {
    prisma.posRegister.findUnique.mockResolvedValue(null);
    await expect(
      service.updateRegister('missing', { name: 'A' }, 'admin1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists sales with pagination and search', async () => {
    prisma.$transaction.mockResolvedValue([
      1,
      [
        {
          id: 's1',
          saleNumber: 'POS-20260923-000001',
          createdAt: new Date(),
          completedAt: new Date(),
          registerId: 'r1',
          register: { id: 'r1', code: 'KASA1', name: 'Kasa 1' },
          userId: 'u1',
          user: {
            id: 'u1',
            firstName: 'Murat',
            lastName: 'B',
            email: 'm@t.com',
          },
          customerId: null,
          customer: null,
          grandTotal: new Prisma.Decimal('100.00'),
          status: PosSaleStatus.COMPLETED,
          payments: [{ method: PosPaymentMethod.CASH }],
        },
      ],
    ]);

    const result = await service.listSales(
      {
        page: 1,
        limit: 20,
        search: 'POS-20260923',
      },
      admin,
    );
    expect(result.meta.total).toBe(1);
    expect(result.items[0].saleNumber).toContain('POS-');
    expect(result.items[0].paymentMethods).toEqual(['CASH']);
  });

  it('scopes cashier list to own sales', async () => {
    prisma.$transaction.mockResolvedValue([0, []]);
    await service.listSales({ page: 1, limit: 20 }, cashier);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(service.shouldScopeToOwnSales(cashier)).toBe(true);
    expect(service.shouldScopeToOwnSales(admin)).toBe(false);
  });

  it('rejects invalid date', async () => {
    await expect(
      service.listSales({ page: 1, limit: 20, dateFrom: 'bad' }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sale detail includes ledger', async () => {
    posService.getSaleById.mockResolvedValue({
      id: 's1',
      userId: 'admin1',
      saleNumber: 'POS-1',
      payments: [{ id: 'pay-1' }],
      account: null,
    });
    prisma.accountTransaction.findMany.mockResolvedValue([
      {
        id: 'l1',
        type: 'SALE',
        amount: new Prisma.Decimal('100'),
        description: 'POS',
        reference: 'SALE:POS:s1',
        referenceType: 'POS_SALE',
        referenceId: 's1',
        createdAt: new Date(),
      },
    ]);
    const detail = await service.getSaleDetail('s1', admin);
    expect(detail.ledger).toHaveLength(1);
    expect(detail.ledger[0].debit).toBe('100.00');
  });

  it('cashier cannot view another sale (IDOR)', async () => {
    posService.getSaleById.mockResolvedValue({
      id: 's2',
      userId: 'other-cashier',
      saleNumber: 'POS-2',
      payments: [],
      account: null,
    });
    await expect(service.getSaleDetail('s2', cashier)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('SUPER_ADMIN can view any sale', async () => {
    posService.getSaleById.mockResolvedValue({
      id: 's2',
      userId: 'other',
      saleNumber: 'POS-2',
      payments: [],
      account: null,
    });
    prisma.accountTransaction.findMany.mockResolvedValue([]);
    const detail = await service.getSaleDetail('s2', admin);
    expect(detail.id).toBe('s2');
  });
});
