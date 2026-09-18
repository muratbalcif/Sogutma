import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const prisma = {
    payment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    order: { findUnique: jest.fn() },
    bankTransferNotification: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    processedWebhookEvent: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };
  const accountingService = { recordIfAbsent: jest.fn() };
  const paymentStatusService = { assertTransition: jest.fn() };
  const orderStatusService = { assertTransition: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(24) };
  const developmentProvider = {
    name: 'development',
    createPayment: jest.fn(),
    verifyWebhook: jest.fn(),
    refundPayment: jest.fn(),
  };

  const service = new PaymentsService(
    prisma as never,
    accountingService as never,
    paymentStatusService,
    orderStatusService as never,
    config as never,
    developmentProvider as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue(24);
  });

  it('returns existing payment for idempotency key', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay1',
      orderId: 'ord1',
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.PENDING,
      amount: new Prisma.Decimal('100.00'),
      currency: 'TRY',
      provider: null,
      providerPaymentId: null,
      idempotencyKey: 'key-1',
      failureCode: null,
      failureMessage: null,
      paidAt: null,
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createForOrder(
      'u1',
      'ord1',
      { method: PaymentMethod.BANK_TRANSFER },
      'key-1',
    );
    expect(result.id).toBe('pay1');
    expect(result.amount).toBe('100.00');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('rejects non-bank-transfer methods in v1', async () => {
    await expect(
      service.createForOrder('u1', 'ord1', {
        method: PaymentMethod.CREDIT_CARD,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects payment for another user order', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.order.findUnique.mockResolvedValue({
      id: 'ord1',
      userId: 'other',
      status: OrderStatus.PENDING,
      totalAmount: new Prisma.Decimal('100.00'),
      currency: 'TRY',
      payments: [],
    });

    await expect(
      service.createForOrder('u1', 'ord1', {
        method: PaymentMethod.BANK_TRANSFER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when order already paid', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.order.findUnique.mockResolvedValue({
      id: 'ord1',
      userId: 'u1',
      status: OrderStatus.PENDING,
      totalAmount: new Prisma.Decimal('100.00'),
      currency: 'TRY',
      payments: [{ id: 'paid', status: PaymentStatus.PAID }],
    });

    await expect(
      service.createForOrder('u1', 'ord1', {
        method: PaymentMethod.BANK_TRANSFER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns existing pending bank transfer payment', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    const pending = {
      id: 'pay-existing',
      orderId: 'ord1',
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.PENDING,
      amount: new Prisma.Decimal('100.00'),
      currency: 'TRY',
      provider: null,
      providerPaymentId: null,
      idempotencyKey: null,
      failureCode: null,
      failureMessage: null,
      paidAt: null,
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.order.findUnique.mockResolvedValue({
      id: 'ord1',
      userId: 'u1',
      status: OrderStatus.PENDING,
      totalAmount: new Prisma.Decimal('100.00'),
      currency: 'TRY',
      payments: [pending],
    });

    const result = await service.createForOrder('u1', 'ord1', {
      method: PaymentMethod.BANK_TRANSFER,
    });
    expect(result.id).toBe('pay-existing');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('listAdmin applies status and method filters', async () => {
    prisma.$transaction.mockResolvedValue([0, []]);
    await service.listAdmin({
      page: 1,
      limit: 20,
      status: PaymentStatus.PAID,
      method: PaymentMethod.BANK_TRANSFER,
      orderNumber: 'FS-1',
    });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.payment.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: PaymentStatus.PAID,
        method: PaymentMethod.BANK_TRANSFER,
        order: { orderNumber: 'FS-1' },
      }),
    });
  });

  it('refundPayment is idempotent for already refunded payments', async () => {
    const refunded = {
      id: 'pay1',
      orderId: 'ord1',
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.REFUNDED,
      amount: new Prisma.Decimal('100.00'),
      currency: 'TRY',
      provider: null,
      providerPaymentId: null,
      idempotencyKey: null,
      failureCode: null,
      failureMessage: null,
      paidAt: new Date(),
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      order: { userId: 'u1' },
    };
    prisma.payment.findUnique.mockResolvedValue(refunded);

    const result = await service.refundPayment('pay1');
    expect(result.status).toBe(PaymentStatus.REFUNDED);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(paymentStatusService.assertTransition).not.toHaveBeenCalled();
  });
});
