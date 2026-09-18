import { BadRequestException } from '@nestjs/common';
import {
  AccountTransactionType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { BankTransferService } from './bank-transfer.service';
import { PaymentsService } from './payments.service';

describe('BankTransferService partial create', () => {
  const prisma = {
    order: { findUnique: jest.fn() },
    bankTransferNotification: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const paymentsService = {
    sumApprovedTransfers: jest.fn(),
    remainingFrom: jest.fn(
      (total: Prisma.Decimal, approved: Prisma.Decimal) => {
        const r = total.sub(approved);
        return r.lt(0) ? new Prisma.Decimal(0) : r;
      },
    ),
  };

  const service = new BankTransferService(
    prisma as never,
    paymentsService as never,
    { requireActive: jest.fn() } as never,
    { enqueue: jest.fn() } as never,
    undefined,
  );

  it('rejects create when amount exceeds remaining', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      orderNumber: 'FS-1',
      totalAmount: new Prisma.Decimal('100000.00'),
      currency: 'TRY',
      user: { email: 'a@b.com', firstName: 'A', lastName: 'B' },
      payments: [
        {
          id: 'pay-1',
          method: 'BANK_TRANSFER',
          status: PaymentStatus.PARTIALLY_PAID,
        },
      ],
    });
    prisma.bankTransferNotification.findFirst.mockResolvedValue(null);
    paymentsService.sumApprovedTransfers.mockResolvedValue(
      new Prisma.Decimal('70000.00'),
    );

    await expect(
      service.createNotification('user-1', 'order-1', {
        bankAccountId: 'bank-1',
        amount: '40000.00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PaymentsService.applyApprovedBankTransfer', () => {
  const accountingService = {
    recordIfAbsent: jest.fn().mockResolvedValue({ created: true }),
  };
  const paymentStatusService = {
    assertTransition: jest.fn(),
  };
  const orderStatusService = {
    applyTransitionInTransaction: jest.fn(),
  };
  const prisma = {
    bankTransferNotification: { aggregate: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue(48) };
  const developmentProvider = { name: 'development' };

  const service = new PaymentsService(
    prisma as never,
    accountingService as never,
    paymentStatusService as never,
    orderStatusService as never,
    config as never,
    developmentProvider as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    accountingService.recordIfAbsent.mockResolvedValue({ created: true });
  });

  it('credits notification amount and sets PARTIALLY_PAID', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay-1',
          status: PaymentStatus.PENDING,
          amount: new Prisma.Decimal('100.00'),
        }),
        update: jest.fn(),
      },
      bankTransferNotification: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: new Prisma.Decimal('30.00') },
        }),
      },
      order: { findUnique: jest.fn() },
    };

    const result = await service.applyApprovedBankTransfer(
      {
        paymentId: 'pay-1',
        notificationId: 'n1',
        notificationAmount: new Prisma.Decimal('30.00'),
        orderId: 'o1',
        orderTotal: new Prisma.Decimal('100.00'),
        userId: 'u1',
        currency: 'TRY',
        orderNumber: 'FS-1',
      },
      tx as never,
    );

    expect(result.fullyPaid).toBe(false);
    expect(accountingService.recordIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'PAYMENT:BANK_TRANSFER:n1',
        type: AccountTransactionType.PAYMENT,
      }),
    );
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { status: PaymentStatus.PARTIALLY_PAID, paidAt: null },
    });
  });

  it('sets PAID and syncs order when approved total covers order', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay-1',
          status: PaymentStatus.PARTIALLY_PAID,
          amount: new Prisma.Decimal('100.00'),
        }),
        update: jest.fn(),
      },
      bankTransferNotification: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: new Prisma.Decimal('100.00') },
        }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'o1',
          status: 'PENDING',
        }),
      },
    };

    const result = await service.applyApprovedBankTransfer(
      {
        paymentId: 'pay-1',
        notificationId: 'n3',
        notificationAmount: new Prisma.Decimal('50.00'),
        orderId: 'o1',
        orderTotal: new Prisma.Decimal('100.00'),
        userId: 'u1',
        currency: 'TRY',
        orderNumber: 'FS-1',
      },
      tx as never,
    );

    expect(result.fullyPaid).toBe(true);
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { status: PaymentStatus.PAID, paidAt: expect.any(Date) },
    });
    expect(orderStatusService.applyTransitionInTransaction).toHaveBeenCalled();
  });

  it('ledger reference stays idempotent across re-entry', async () => {
    accountingService.recordIfAbsent.mockResolvedValueOnce({ created: false });
    const tx = {
      $queryRaw: jest.fn(),
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay-1',
          status: PaymentStatus.PARTIALLY_PAID,
          amount: new Prisma.Decimal('100.00'),
        }),
        update: jest.fn(),
      },
      bankTransferNotification: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: new Prisma.Decimal('30.00') },
        }),
      },
      order: { findUnique: jest.fn() },
    };

    await service.applyApprovedBankTransfer(
      {
        paymentId: 'pay-1',
        notificationId: 'n1',
        notificationAmount: new Prisma.Decimal('30.00'),
        orderId: 'o1',
        orderTotal: new Prisma.Decimal('100.00'),
        userId: 'u1',
        currency: 'TRY',
        orderNumber: 'FS-1',
      },
      tx as never,
    );

    expect(accountingService.recordIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'PAYMENT:BANK_TRANSFER:n1',
      }),
    );
    expect(tx.payment.update).not.toHaveBeenCalled();
  });
});
