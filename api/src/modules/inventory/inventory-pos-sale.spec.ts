import { ConflictException } from '@nestjs/common';
import { InventoryTransactionType } from '@prisma/client';
import { InventoryService } from './inventory.service';

describe('InventoryService.sellAvailableInTransaction', () => {
  const lockInventory = jest.fn();
  const getOrCreateLocked = jest.fn();
  const inventoryUpdate = jest.fn();
  const inventoryTxCreate = jest.fn();

  const tx = {
    inventory: { update: inventoryUpdate },
    inventoryTransaction: {
      findFirst: jest.fn(),
      create: inventoryTxCreate,
    },
  };

  const service = Object.create(InventoryService.prototype) as InventoryService;
  (
    service as unknown as { lockInventory: typeof lockInventory }
  ).lockInventory = lockInventory;
  (
    service as unknown as { getOrCreateLocked: typeof getOrCreateLocked }
  ).getOrCreateLocked = getOrCreateLocked;
  (
    service as unknown as {
      toResponse: (row: {
        id: string;
        productId: string;
        quantity: number;
        reservedQuantity: number;
        minimumQuantity: number;
      }) => unknown;
    }
  ).toResponse = (row) => ({
    id: row.id,
    productId: row.productId,
    quantity: row.quantity,
    reservedQuantity: row.reservedQuantity,
    availableQuantity: row.quantity - row.reservedQuantity,
    minimumQuantity: row.minimumQuantity,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    lockInventory.mockResolvedValue(undefined);
    tx.inventoryTransaction.findFirst.mockResolvedValue(null);
  });

  it('decreases available stock and writes SALE transaction', async () => {
    getOrCreateLocked.mockResolvedValue({
      id: 'inv1',
      productId: 'p1',
      quantity: 10,
      reservedQuantity: 2,
      minimumQuantity: 0,
    });
    inventoryUpdate.mockResolvedValue({
      id: 'inv1',
      productId: 'p1',
      quantity: 7,
      reservedQuantity: 2,
      minimumQuantity: 0,
    });
    inventoryTxCreate.mockResolvedValue({});

    const result = await service.sellAvailableInTransaction(
      tx as never,
      'p1',
      3,
      { referenceType: 'SALE', referenceId: 'si1', createdBy: 'admin1' },
    );

    expect(result.quantity).toBe(7);
    expect(result.availableQuantity).toBe(5);
    expect(inventoryUpdate).toHaveBeenCalledWith({
      where: { id: 'inv1' },
      data: { quantity: 7 },
    });
    expect(inventoryTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: InventoryTransactionType.SALE,
        quantity: 3,
        referenceType: 'SALE',
        referenceId: 'si1',
      }),
    });
  });

  it('rejects when available stock is insufficient', async () => {
    getOrCreateLocked.mockResolvedValue({
      id: 'inv1',
      productId: 'p1',
      quantity: 5,
      reservedQuantity: 4,
      minimumQuantity: 0,
    });

    await expect(
      service.sellAvailableInTransaction(tx as never, 'p1', 2),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(inventoryUpdate).not.toHaveBeenCalled();
  });
});
