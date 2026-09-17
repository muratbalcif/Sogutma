import { ConflictException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const prisma = {
    inventory: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    inventoryTransaction: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const service = new InventoryService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    });
    prisma.$queryRaw.mockResolvedValue([]);
  });

  it('increases stock and writes transaction', async () => {
    prisma.inventory.findUnique.mockResolvedValue({
      id: 'inv-1',
      productId: 'p1',
      quantity: 5,
      reservedQuantity: 1,
      minimumQuantity: 0,
    });
    prisma.inventory.update.mockResolvedValue({
      id: 'inv-1',
      productId: 'p1',
      quantity: 8,
      reservedQuantity: 1,
      minimumQuantity: 0,
    });

    const result = await service.increaseStock('p1', 3, { note: 'restock' });

    expect(result.quantity).toBe(8);
    expect(result.availableQuantity).toBe(7);
    expect(prisma.inventoryTransaction.create).toHaveBeenCalledTimes(1);
  });

  it('rejects decrease below zero', async () => {
    prisma.inventory.findUnique.mockResolvedValue({
      id: 'inv-1',
      productId: 'p1',
      quantity: 2,
      reservedQuantity: 0,
      minimumQuantity: 0,
    });

    await expect(service.decreaseStock('p1', 3)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('reserves stock and reduces availability', async () => {
    prisma.inventory.findUnique.mockResolvedValue({
      id: 'inv-1',
      productId: 'p1',
      quantity: 10,
      reservedQuantity: 2,
      minimumQuantity: 0,
    });
    prisma.inventory.update.mockResolvedValue({
      id: 'inv-1',
      productId: 'p1',
      quantity: 10,
      reservedQuantity: 5,
      minimumQuantity: 0,
    });

    const result = await service.reserveStock('p1', 3);
    expect(result.reservedQuantity).toBe(5);
    expect(result.availableQuantity).toBe(5);
    expect(prisma.inventoryTransaction.create).toHaveBeenCalledTimes(1);
  });

  it('rejects insufficient reservation', async () => {
    prisma.inventory.findUnique.mockResolvedValue({
      id: 'inv-1',
      productId: 'p1',
      quantity: 4,
      reservedQuantity: 2,
      minimumQuantity: 0,
    });

    await expect(service.reserveStock('p1', 3)).rejects.toThrow(
      'Insufficient stock',
    );
  });

  it('releases reserved stock', async () => {
    prisma.inventory.findUnique.mockResolvedValue({
      id: 'inv-1',
      productId: 'p1',
      quantity: 10,
      reservedQuantity: 4,
      minimumQuantity: 0,
    });
    prisma.inventory.update.mockResolvedValue({
      id: 'inv-1',
      productId: 'p1',
      quantity: 10,
      reservedQuantity: 1,
      minimumQuantity: 0,
    });

    const result = await service.releaseStock('p1', 3);
    expect(result.reservedQuantity).toBe(1);
    expect(result.availableQuantity).toBe(9);
  });

  it('rejects release below zero reserved', async () => {
    prisma.inventory.findUnique.mockResolvedValue({
      id: 'inv-1',
      productId: 'p1',
      quantity: 10,
      reservedQuantity: 1,
      minimumQuantity: 0,
    });

    await expect(service.releaseStock('p1', 2)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
