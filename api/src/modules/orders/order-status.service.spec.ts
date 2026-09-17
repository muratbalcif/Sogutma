import { BadRequestException, ConflictException } from '@nestjs/common';
import { InventoryTransactionType, OrderStatus } from '@prisma/client';
import { OrderStatusService } from './order-status.service';

describe('OrderStatusService matrix', () => {
  const service = new OrderStatusService({} as never);

  it('allows customer cancel from PENDING and CONFIRMED', () => {
    expect(service.canCustomerCancel(OrderStatus.PENDING)).toBe(true);
    expect(service.canCustomerCancel(OrderStatus.CONFIRMED)).toBe(true);
    expect(service.canCustomerCancel(OrderStatus.PREPARING)).toBe(false);
    expect(service.canCustomerCancel(OrderStatus.SHIPPED)).toBe(false);
  });

  it('allows valid transitions including PREPARING → CANCELLED', () => {
    expect(() =>
      service.assertTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED),
    ).not.toThrow();
    expect(() =>
      service.assertTransition(OrderStatus.CONFIRMED, OrderStatus.PREPARING),
    ).not.toThrow();
    expect(() =>
      service.assertTransition(OrderStatus.PREPARING, OrderStatus.SHIPPED),
    ).not.toThrow();
    expect(() =>
      service.assertTransition(OrderStatus.PREPARING, OrderStatus.CANCELLED),
    ).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() =>
      service.assertTransition(OrderStatus.DELIVERED, OrderStatus.PREPARING),
    ).toThrow(BadRequestException);
    expect(() =>
      service.assertTransition(OrderStatus.CANCELLED, OrderStatus.PENDING),
    ).toThrow(BadRequestException);
  });
});

describe('OrderStatusService.applyTransitionInTransaction', () => {
  const inventoryService = {
    releaseStockInTransaction: jest.fn(),
  };
  const service = new OrderStatusService(inventoryService as never);

  function makeTx(order: Record<string, unknown>) {
    return {
      $queryRaw: jest.fn(),
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: jest.fn(),
      },
      orderStatusHistory: { create: jest.fn() },
      payment: { updateMany: jest.fn() },
      shipping: { update: jest.fn() },
      orderReturn: { upsert: jest.fn() },
      orderItem: {
        findMany: jest
          .fn()
          .mockResolvedValue(
            (order.items as Array<{ productId: string; quantity: number }>) ??
              [],
          ),
      },
      inventoryTransaction: { findFirst: jest.fn().mockResolvedValue(null) },
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PENDING → CONFIRMED', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.PENDING,
      items: [],
      shipping: null,
    });
    const result = await service.applyTransitionInTransaction(tx as never, {
      orderId: 'o1',
      toStatus: OrderStatus.CONFIRMED,
      changedByUserId: 'admin',
    });
    expect(result.toStatus).toBe(OrderStatus.CONFIRMED);
    expect(tx.order.update).toHaveBeenCalled();
    expect(tx.orderStatusHistory.create).toHaveBeenCalled();
  });

  it('CONFIRMED → PREPARING', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.CONFIRMED,
      items: [],
      shipping: null,
    });
    await service.applyTransitionInTransaction(tx as never, {
      orderId: 'o1',
      toStatus: OrderStatus.PREPARING,
      changedByUserId: 'admin',
    });
    expect(tx.order.update).toHaveBeenCalled();
  });

  it('PREPARING → SHIPPED', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.PREPARING,
      items: [],
      shipping: null,
    });
    await service.applyTransitionInTransaction(tx as never, {
      orderId: 'o1',
      toStatus: OrderStatus.SHIPPED,
      changedByUserId: 'admin',
    });
    expect(tx.order.update).toHaveBeenCalled();
  });

  it('SHIPPED → DELIVERED updates shipping', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.SHIPPED,
      items: [],
      shipping: { id: 's1', deliveredAt: null },
    });
    await service.applyTransitionInTransaction(tx as never, {
      orderId: 'o1',
      toStatus: OrderStatus.DELIVERED,
      changedByUserId: 'admin',
    });
    expect(tx.shipping.update).toHaveBeenCalled();
  });

  it('rejects DELIVERED → PREPARING', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.DELIVERED,
      items: [],
      shipping: null,
    });
    await expect(
      service.applyTransitionInTransaction(tx as never, {
        orderId: 'o1',
        toStatus: OrderStatus.PREPARING,
        changedByUserId: 'admin',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancel releases stock once and skips second release', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.PENDING,
      items: [{ productId: 'p1', quantity: 2 }],
      shipping: null,
    });
    await service.applyTransitionInTransaction(tx as never, {
      orderId: 'o1',
      toStatus: OrderStatus.CANCELLED,
      changedByUserId: 'u1',
      customerCancel: true,
    });
    expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);

    tx.inventoryTransaction.findFirst.mockResolvedValue({
      id: 'rel1',
      type: InventoryTransactionType.RELEASE,
    });
    inventoryService.releaseStockInTransaction.mockClear();
    // Simulate already cancelled conflict on second cancel attempt
    tx.order.findUnique.mockResolvedValue({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.CANCELLED,
      items: [{ productId: 'p1', quantity: 2 }],
      shipping: null,
    });
    await expect(
      service.applyTransitionInTransaction(tx as never, {
        orderId: 'o1',
        toStatus: OrderStatus.CANCELLED,
        changedByUserId: 'u1',
        customerCancel: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
  });

  it('releaseOrderStockOnce skips when RELEASE already exists', async () => {
    const tx = {
      orderItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ productId: 'p1', quantity: 2 }]),
      },
      inventoryTransaction: {
        findFirst: jest.fn().mockResolvedValue({ id: 'already' }),
      },
    };
    await service.releaseOrderStockOnce(tx as never, 'o1', 'u1');
    expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
  });
});
