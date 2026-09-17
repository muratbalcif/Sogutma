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
  const inventoryService = { releaseStockInTransaction: jest.fn() };
  const notificationsService = { enqueueOrderStatus: jest.fn() };
  const emailOutbox = { enqueue: jest.fn() };

  const service = new PaymentExpirationService(
    prisma as never,
    inventoryService as never,
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

  it('cancels pending expired payment and releases stock once', async () => {
    prisma.payment.findMany.mockResolvedValue([{ id: 'p1' }]);
    const txPaymentUpdate = jest.fn();
    const txOrderUpdate = jest.fn();
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
          order: { update: txOrderUpdate },
          orderStatusHistory: { create: jest.fn() },
        });
      },
    );

    const count: number = await service.expirePendingPayments();
    expect(count).toBe(1);
    expect(txPaymentUpdate).toHaveBeenCalled();
    expect(inventoryService.releaseStockInTransaction).toHaveBeenCalled();
    expect(notificationsService.enqueueOrderStatus).toHaveBeenCalled();
    expect(emailOutbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'OrderCancelled' }),
    );
  });
});
