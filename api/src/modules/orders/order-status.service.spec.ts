import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InventoryTransactionType, OrderStatus } from '@prisma/client';
import { OrderStatusService } from './order-status.service';

describe('OrderStatusService matrix', () => {
  const service = new OrderStatusService({} as never, {} as never);

  it('allows customer cancel from PENDING and unpaid CONFIRMED', () => {
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
    commitSaleInTransaction: jest.fn(),
    commitReturnInTransaction: jest.fn(),
  };
  const accountingService = {
    reverseSaleForCancelledOrder: jest.fn(),
  };
  const service = new OrderStatusService(
    inventoryService as never,
    accountingService as never,
  );

  function makeTx(order: Record<string, unknown>) {
    return {
      $queryRaw: jest.fn(),
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: jest.fn(),
      },
      orderStatusHistory: { create: jest.fn() },
      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
      },
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

  it('PENDING → CONFIRMED without paid payment does not commit SALE', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.PENDING,
      items: [{ productId: 'p1', quantity: 2 }],
      shipping: null,
    });
    const result = await service.applyTransitionInTransaction(tx as never, {
      orderId: 'o1',
      toStatus: OrderStatus.CONFIRMED,
      changedByUserId: 'admin',
    });
    expect(result.toStatus).toBe(OrderStatus.CONFIRMED);
    expect(inventoryService.commitSaleInTransaction).not.toHaveBeenCalled();
  });

  it('PENDING → CONFIRMED with PAID payment commits SALE', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.PENDING,
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
      shipping: null,
    });
    tx.payment.findFirst.mockResolvedValue({ id: 'pay1' });

    await service.applyTransitionInTransaction(tx as never, {
      orderId: 'o1',
      toStatus: OrderStatus.CONFIRMED,
      changedByUserId: 'admin',
    });

    expect(inventoryService.commitSaleInTransaction).toHaveBeenCalledTimes(2);
    expect(inventoryService.commitSaleInTransaction).toHaveBeenCalledWith(
      tx,
      'p1',
      2,
      expect.objectContaining({
        referenceType: 'ORDER',
        referenceId: 'o1',
      }),
    );
  });

  it('duplicate SALE commit is skipped when SALE row exists', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.PENDING,
      items: [{ productId: 'p1', quantity: 2 }],
      shipping: null,
    });
    tx.payment.findFirst.mockResolvedValue({ id: 'pay1' });
    tx.inventoryTransaction.findFirst.mockResolvedValue({
      id: 'sale1',
      type: InventoryTransactionType.SALE,
    });

    await service.applyTransitionInTransaction(tx as never, {
      orderId: 'o1',
      toStatus: OrderStatus.CONFIRMED,
      changedByUserId: 'admin',
    });

    expect(inventoryService.commitSaleInTransaction).not.toHaveBeenCalled();
  });

  it('rejects cancel when a PAID payment exists', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.CONFIRMED,
      items: [],
      shipping: null,
    });
    tx.payment.findFirst.mockResolvedValue({ id: 'pay1' });

    await expect(
      service.applyTransitionInTransaction(tx as never, {
        orderId: 'o1',
        toStatus: OrderStatus.CANCELLED,
        changedByUserId: 'admin',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    expect(accountingService.reverseSaleForCancelledOrder).not.toHaveBeenCalled();
  });

  it('cancel releases stock once and reverses SALE', async () => {
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
    expect(accountingService.reverseSaleForCancelledOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'o1',
        userId: 'u1',
        orderNumber: 'FS-1',
      }),
    );

    tx.inventoryTransaction.findFirst.mockResolvedValue({
      id: 'rel1',
      type: InventoryTransactionType.RELEASE,
    });
    inventoryService.releaseStockInTransaction.mockClear();
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
        customerCancel: true,
        changedByUserId: 'u1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid admin transition', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.PENDING,
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

  it('DELIVERED → RETURNED restocks SALE quantities', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.DELIVERED,
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
      shipping: null,
    });
    tx.inventoryTransaction.findFirst.mockImplementation(
      (args: {
        where: { type?: InventoryTransactionType; productId?: string };
      }) => {
        if (args.where.type === InventoryTransactionType.RETURN) {
          return Promise.resolve(null);
        }
        if (args.where.type === InventoryTransactionType.SALE) {
          return Promise.resolve({
            id: 'sale',
            quantity: args.where.productId === 'p2' ? 1 : 2,
            type: InventoryTransactionType.SALE,
          });
        }
        return Promise.resolve(null);
      },
    );

    await service.applyTransitionInTransaction(tx as never, {
      orderId: 'o1',
      toStatus: OrderStatus.RETURNED,
      changedByUserId: 'admin',
      returnReason: 'defect',
    });

    expect(tx.orderReturn.upsert).toHaveBeenCalled();
    expect(inventoryService.commitReturnInTransaction).toHaveBeenCalledTimes(2);
    expect(inventoryService.commitReturnInTransaction).toHaveBeenCalledWith(
      tx,
      'p1',
      2,
      expect.objectContaining({
        referenceType: 'ORDER',
        referenceId: 'o1',
      }),
    );
  });

  it('RETURNED skips restock when no SALE (e.g. cancelled reservation)', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.DELIVERED,
      items: [{ productId: 'p1', quantity: 2 }],
      shipping: null,
    });
    // findFirst always null → no RETURN, no SALE
    await service.applyTransitionInTransaction(tx as never, {
      orderId: 'o1',
      toStatus: OrderStatus.RETURNED,
      changedByUserId: 'admin',
    });
    expect(inventoryService.commitReturnInTransaction).not.toHaveBeenCalled();
  });

  it('duplicate RETURN is skipped when RETURN row exists', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.DELIVERED,
      items: [{ productId: 'p1', quantity: 2 }],
      shipping: null,
    });
    tx.inventoryTransaction.findFirst.mockResolvedValue({
      id: 'ret1',
      type: InventoryTransactionType.RETURN,
    });

    await service.applyTransitionInTransaction(tx as never, {
      orderId: 'o1',
      toStatus: OrderStatus.RETURNED,
      changedByUserId: 'admin',
    });

    expect(inventoryService.commitReturnInTransaction).not.toHaveBeenCalled();
  });

  it('partial return restocks only requested quantity', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.DELIVERED,
      items: [{ productId: 'p1', quantity: 5 }],
      shipping: null,
    });
    tx.inventoryTransaction.findFirst.mockImplementation(
      (args: { where: { type?: InventoryTransactionType } }) => {
        if (args.where.type === InventoryTransactionType.RETURN) {
          return Promise.resolve(null);
        }
        if (args.where.type === InventoryTransactionType.SALE) {
          return Promise.resolve({
            id: 'sale',
            quantity: 5,
            type: InventoryTransactionType.SALE,
          });
        }
        return Promise.resolve(null);
      },
    );

    await service.restockOrderReturnOnce(tx as never, 'o1', 'admin', {
      p1: 2,
    });

    expect(inventoryService.commitReturnInTransaction).toHaveBeenCalledWith(
      tx,
      'p1',
      2,
      expect.objectContaining({ referenceId: 'o1' }),
    );
  });

  it('rolls back RETURNED transition when restock throws', async () => {
    const tx = makeTx({
      id: 'o1',
      userId: 'u1',
      orderNumber: 'FS-1',
      status: OrderStatus.DELIVERED,
      items: [{ productId: 'p1', quantity: 1 }],
      shipping: null,
    });
    tx.inventoryTransaction.findFirst.mockImplementation(
      (args: { where: { type?: InventoryTransactionType } }) => {
        if (args.where.type === InventoryTransactionType.SALE) {
          return Promise.resolve({
            id: 'sale',
            quantity: 1,
            type: InventoryTransactionType.SALE,
          });
        }
        return Promise.resolve(null);
      },
    );
    inventoryService.commitReturnInTransaction.mockRejectedValue(
      new ConflictException('boom'),
    );

    await expect(
      service.applyTransitionInTransaction(tx as never, {
        orderId: 'o1',
        toStatus: OrderStatus.RETURNED,
        changedByUserId: 'admin',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.order.update).not.toHaveBeenCalled();
  });
});
