import { BadRequestException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { BankTransferService } from './bank-transfer.service';

describe('BankTransferService claim validation', () => {
  const prisma = {
    order: { findUnique: jest.fn() },
    bankTransferNotification: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    payment: { update: jest.fn() },
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

  const bankAccounts = { requireActive: jest.fn() };

  const service = new BankTransferService(
    prisma as never,
    paymentsService as never,
    bankAccounts as never,
    { enqueue: jest.fn() } as never,
    undefined,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      orderNumber: 'FS-20260918-000001',
      totalAmount: new Prisma.Decimal('27000.00'),
      currency: 'TRY',
      user: { email: 'a@b.com', firstName: 'A', lastName: 'B' },
      payments: [
        {
          id: 'pay-1',
          method: 'BANK_TRANSFER',
          status: PaymentStatus.PENDING,
          paymentReference: 'FS-20260918-000001-ABC123',
        },
      ],
    });
    prisma.bankTransferNotification.findFirst.mockResolvedValue(null);
    paymentsService.sumApprovedTransfers.mockResolvedValue(
      new Prisma.Decimal('0'),
    );
  });

  it('requires bankAccountId', async () => {
    await expect(
      service.createNotification('user-1', 'order-1', {} as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bankAccounts.requireActive).not.toHaveBeenCalled();
  });

  it('stores paymentReference as claim referenceNumber', async () => {
    bankAccounts.requireActive.mockResolvedValue({ id: 'bank-1' });
    prisma.bankTransferNotification.create.mockResolvedValue({
      id: 'n1',
      orderId: 'order-1',
      paymentId: 'pay-1',
      bankAccountId: 'bank-1',
      amount: new Prisma.Decimal('27000.00'),
      currency: 'TRY',
      amountMismatch: false,
      senderName: 'A B',
      senderIban: null,
      transferDate: new Date(),
      referenceNumber: 'FS-20260918-000001-ABC123',
      note: null,
      status: 'PENDING',
      rejectionReason: null,
      adminNote: null,
      verifiedAt: null,
      createdAt: new Date(),
      bankAccount: { bankName: 'Ziraat', iban: 'TR33' },
      payment: {
        id: 'pay-1',
        status: PaymentStatus.PENDING,
        paymentReference: 'FS-20260918-000001-ABC123',
      },
      order: {
        orderNumber: 'FS-20260918-000001',
        totalAmount: new Prisma.Decimal('27000.00'),
        user: { firstName: 'A', lastName: 'B' },
      },
    });

    await service.createNotification('user-1', 'order-1', {
      bankAccountId: 'bank-1',
    });

    expect(prisma.bankTransferNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bankAccountId: 'bank-1',
          referenceNumber: 'FS-20260918-000001-ABC123',
          amount: new Prisma.Decimal('27000.00'),
        }),
      }),
    );
  });
});
