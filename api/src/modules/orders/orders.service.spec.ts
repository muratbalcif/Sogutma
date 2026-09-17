import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, UserType } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const prisma = {
    $transaction: jest.fn(),
    order: {
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', status: 'ACTIVE' }),
    },
  };
  const priceService = { resolvePricesForProducts: jest.fn() };
  const inventoryService = {
    reserveStockInTransaction: jest.fn(),
    releaseStockInTransaction: jest.fn(),
  };
  const addressesService = {
    getOwned: jest.fn(),
    toSnapshot: jest.fn((address: { city: string; title: string }) => ({
      title: address.title,
      city: address.city,
      firstName: 'A',
      lastName: 'B',
      phone: '1',
      district: 'D',
      neighborhood: null,
      addressLine: 'Line',
      postalCode: null,
      country: 'TR',
    })),
  };
  const orderStatusService = {
    canCustomerCancel: jest.fn().mockReturnValue(true),
    assertTransition: jest.fn(),
    getAllowedTransitions: jest.fn().mockReturnValue([]),
    applyTransitionInTransaction: jest.fn(),
  };
  const shippingService = {
    upsertManualShipmentInTransaction: jest.fn(),
  };

  const config = { get: jest.fn().mockReturnValue(24) };
  const bankAccountsService = { listPublic: jest.fn().mockResolvedValue([]) };
  const emailOutbox = { enqueue: jest.fn(), enqueueOrderEmail: jest.fn() };

  const couponsService = {
    validateForUser: jest.fn(),
    recordUsage: jest.fn(),
  };

  const accountingService = {
    assertCreditLimitAllows: jest.fn().mockResolvedValue(undefined),
    recordIfAbsent: jest.fn().mockResolvedValue({ created: true }),
  };

  const service = new OrdersService(
    prisma as never,
    priceService as never,
    inventoryService as never,
    addressesService as never,
    bankAccountsService as never,
    emailOutbox as never,
    config as never,
    shippingService as never,
    orderStatusService as never,
    couponsService as never,
    accountingService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', status: 'ACTIVE' });
  });

  it('rejects empty cart with 409', async () => {
    addressesService.getOwned.mockResolvedValue({
      id: 'a1',
      title: 'Ev',
      city: 'Mersin',
    });
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue({ id: 'c1', items: [] }),
          },
        };
        return fn(tx);
      },
    );

    await expect(
      service.create('u1', UserType.INDIVIDUAL, {
        shippingAddressId: 'a1',
        billingAddressId: 'a1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks access to another user order', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      userId: 'other',
      items: [],
      statusHistory: [],
      payment: null,
      shippingAddressSnapshot: {},
      billingAddressSnapshot: {},
      subtotal: { toFixed: () => '0.00' },
      discountAmount: { toFixed: () => '0.00' },
      taxAmount: { toFixed: () => '0.00' },
      shippingAmount: { toFixed: () => '0.00' },
      totalAmount: { toFixed: () => '0.00' },
      orderNumber: 'FS-1',
      status: OrderStatus.PENDING,
      currency: 'TRY',
      customerNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.getByIdForUser('u1', 'o1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns not found for missing order', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(service.getAdminById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
