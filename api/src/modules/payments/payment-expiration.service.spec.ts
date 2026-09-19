import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PaymentExpirationService } from './payment-expiration.service';

describe('PaymentExpirationService', () => {
  const prisma = {
    payment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: { update: jest.fn() },
    orderStatusHistory: { create: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const orderStatusService = {
    applyTransitionInTransaction: jest.fn().mockResolvedValue({
      orderId: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      fromStatus: OrderStatus.PENDING,
      toStatus: OrderStatus.CANCELLED,
    }),
  };
  const notificationsService = { enqueueOrderStatus: jest.fn() };
  const emailOutbox = { enqueueOrderEmail: jest.fn() };

  const service = new PaymentExpirationService(
    prisma as never,
    orderStatusService as never,
    notificationsService as never,
    emailOutbox as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (service as unknown as { running: boolean }).running = false;
  });

  it('is idempotent when payment already cancelled', async () => {
    prisma.payment.findMany.mockResolvedValue([{ id: 'p1' }]);
    prisma.$transaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        return fn({
          $queryRaw: jest.fn(),
          payment: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'p1',
              status: PaymentStatus.CANCELLED,
              expiresAt: new Date(Date.now() - 1000),
              method: PaymentMethod.BANK_TRANSFER,
              order: {
                status: OrderStatus.CANCELLED,
                items: [],
                userId: 'u1',
                orderNumber: 'FS-1',
                user: { id: 'u1', email: 'a@b.com' },
              },
            }),
            update: jest.fn(),
          },
          order: { update: jest.fn() },
          orderStatusHistory: { create: jest.fn() },
        });
      },
    );

    const count = await service.expirePendingPayments();
    expect(count).toBe(0);
    expect(notificationsService.enqueueOrderStatus).not.toHaveBeenCalled();
  });

  it('cancels pending expired payment via OrderStatusService', async () => {
    prisma.payment.findMany.mockResolvedValue([{ id: 'p1' }]);
    const txPaymentUpdate = jest.fn();
    prisma.$transaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        return fn({
          $queryRaw: jest.fn(),
          payment: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'p1',
              status: PaymentStatus.PENDING,
              expiresAt: new Date(Date.now() - 1000),
              method: PaymentMethod.BANK_TRANSFER,
              orderId: 'o1',
              order: {
                id: 'o1',
                status: OrderStatus.PENDING,
                userId: 'u1',
                orderNumber: 'FS-1',
                items: [{ productId: 'prod1', quantity: 2 }],
                user: { id: 'u1', email: 'a@b.com' },
              },
            }),
            update: txPaymentUpdate,
          },
          order: { update: jest.fn() },
          orderStatusHistory: { create: jest.fn() },
        });
      },
    );

    const count: number = await service.expirePendingPayments();
    expect(count).toBe(1);
    expect(txPaymentUpdate).toHaveBeenCalled();
    expect(orderStatusService.applyTransitionInTransaction).toHaveBeenCalled();
    expect(notificationsService.enqueueOrderStatus).toHaveBeenCalled();
    expect(emailOutbox.enqueueOrderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'ORDER_CANCELLED' }),
    );
  });
});
