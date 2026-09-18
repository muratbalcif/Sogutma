import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InventoryTransactionType, Prisma } from '@prisma/client';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
  buildPaginatedResponse,
} from '../../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CriticalInventoryItemDto,
  InventoryResponseDto,
  InventoryTransactionResponseDto,
  PublicStockDto,
} from './dto/inventory.dto';

type InventoryRow = {
  id: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  minimumQuantity: number;
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService?: NotificationsService,
  ) {}

  toResponse(inventory: InventoryRow): InventoryResponseDto {
    return {
      id: inventory.id,
      productId: inventory.productId,
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      availableQuantity: inventory.quantity - inventory.reservedQuantity,
      minimumQuantity: inventory.minimumQuantity,
    };
  }

  toPublicStock(inventory: InventoryRow | null): PublicStockDto {
    const availableQuantity = inventory
      ? inventory.quantity - inventory.reservedQuantity
      : 0;
    return {
      available: availableQuantity > 0,
      quantity: Math.max(availableQuantity, 0),
    };
  }

  async ensureInventory(
    productId: string,
    minimumQuantity = 0,
  ): Promise<InventoryResponseDto> {
    const inventory = await this.prisma.inventory.upsert({
      where: { productId },
      update: {},
      create: {
        productId,
        quantity: 0,
        reservedQuantity: 0,
        minimumQuantity,
      },
    });
    return this.toResponse(inventory);
  }

  async getInventory(productId: string): Promise<InventoryResponseDto> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
    });
    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }
    return this.toResponse(inventory);
  }

  async getAvailableQuantity(productId: string): Promise<number> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
    });
    if (!inventory) {
      return 0;
    }
    return inventory.quantity - inventory.reservedQuantity;
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<InventoryResponseDto>> {
    const [total, items] = await this.prisma.$transaction([
      this.prisma.inventory.count(),
      this.prisma.inventory.findMany({
        include: {
          product: { select: { sku: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return buildPaginatedResponse(
      items.map((item) => ({
        ...this.toResponse(item),
        product: item.product,
      })),
      total,
      query.page,
      query.limit,
    );
  }

  async findCritical(): Promise<CriticalInventoryItemDto[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        productId: string;
        sku: string;
        name: string;
        quantity: number;
        reservedQuantity: number;
        minimumQuantity: number;
      }>
    >`
      SELECT
        i."productId",
        p.sku,
        p.name,
        i.quantity,
        i."reservedQuantity",
        i."minimumQuantity"
      FROM inventories i
      INNER JOIN products p ON p.id = i."productId"
      WHERE (i.quantity - i."reservedQuantity") <= i."minimumQuantity"
      ORDER BY (i.quantity - i."reservedQuantity") ASC, p.sku ASC
    `;

    return rows.map((row) => ({
      productId: row.productId,
      sku: row.sku,
      name: row.name,
      quantity: row.quantity,
      reservedQuantity: row.reservedQuantity,
      availableQuantity: row.quantity - row.reservedQuantity,
      minimumQuantity: row.minimumQuantity,
    }));
  }

  async getTransactions(
    productId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<InventoryTransactionResponseDto>> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
    });
    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.inventoryTransaction.count({ where: { productId } }),
      this.prisma.inventoryTransaction.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return buildPaginatedResponse(
      items.map((item) => ({
        id: item.id,
        productId: item.productId,
        type: item.type,
        quantity: item.quantity,
        previousQuantity: item.previousQuantity,
        newQuantity: item.newQuantity,
        note: item.note,
        createdAt: item.createdAt,
      })),
      total,
      query.page,
      query.limit,
    );
  }

  async increaseStock(
    productId: string,
    quantity: number,
    options?: { note?: string; createdBy?: string },
  ): Promise<InventoryResponseDto> {
    const before = await this.getAvailableQuantity(productId);
    const result = await this.mutateStock({
      productId,
      delta: quantity,
      type: InventoryTransactionType.STOCK_IN,
      note: options?.note,
      createdBy: options?.createdBy,
    });
    if (
      before <= 0 &&
      result.availableQuantity > 0 &&
      this.notificationsService
    ) {
      await this.notificationsService.notifyProductBackInStock(productId);
    }
    return result;
  }

  async decreaseStock(
    productId: string,
    quantity: number,
    options?: { note?: string; createdBy?: string },
  ): Promise<InventoryResponseDto> {
    return this.mutateStock({
      productId,
      delta: -quantity,
      type: InventoryTransactionType.STOCK_OUT,
      note: options?.note,
      createdBy: options?.createdBy,
    });
  }

  async adjustStock(
    productId: string,
    quantity: number,
    options?: { note?: string; createdBy?: string },
  ): Promise<InventoryResponseDto> {
    const before = await this.getAvailableQuantity(productId);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockInventory(tx, productId);
      const inventory = await this.getOrCreateLocked(tx, productId);
      if (quantity < inventory.reservedQuantity) {
        throw new ConflictException(
          'Adjusted quantity cannot be below reserved quantity',
        );
      }

      const updated = await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity },
      });

      await tx.inventoryTransaction.create({
        data: {
          productId,
          inventoryId: inventory.id,
          type: InventoryTransactionType.ADJUSTMENT,
          quantity: Math.abs(quantity - inventory.quantity),
          previousQuantity: inventory.quantity,
          newQuantity: quantity,
          note: options?.note,
          createdBy: options?.createdBy,
        },
      });

      return this.toResponse(updated);
    });

    if (
      before <= 0 &&
      result.availableQuantity > 0 &&
      this.notificationsService
    ) {
      await this.notificationsService.notifyProductBackInStock(productId);
    }
    return result;
  }

  async reserveStock(
    productId: string,
    quantity: number,
    options?: {
      note?: string;
      createdBy?: string;
      referenceType?: string;
      referenceId?: string;
    },
  ): Promise<InventoryResponseDto> {
    return this.prisma.$transaction(async (tx) =>
      this.reserveStockInTransaction(tx, productId, quantity, options),
    );
  }

  async releaseStock(
    productId: string,
    quantity: number,
    options?: {
      note?: string;
      createdBy?: string;
      referenceType?: string;
      referenceId?: string;
    },
  ): Promise<InventoryResponseDto> {
    return this.prisma.$transaction(async (tx) =>
      this.releaseStockInTransaction(tx, productId, quantity, options),
    );
  }

  async reserveStockInTransaction(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number,
    options?: {
      note?: string;
      createdBy?: string;
      referenceType?: string;
      referenceId?: string;
    },
  ): Promise<InventoryResponseDto> {
    await this.lockInventory(tx, productId);
    const inventory = await this.getOrCreateLocked(tx, productId);
    const available = inventory.quantity - inventory.reservedQuantity;
    if (available < quantity) {
      throw new ConflictException('Insufficient stock');
    }

    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: { reservedQuantity: inventory.reservedQuantity + quantity },
    });

    await tx.inventoryTransaction.create({
      data: {
        productId,
        inventoryId: inventory.id,
        type: InventoryTransactionType.RESERVATION,
        quantity,
        previousQuantity: inventory.reservedQuantity,
        newQuantity: updated.reservedQuantity,
        note: options?.note,
        createdBy: options?.createdBy,
        referenceType: options?.referenceType,
        referenceId: options?.referenceId,
      },
    });

    return this.toResponse(updated);
  }

  async releaseStockInTransaction(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number,
    options?: {
      note?: string;
      createdBy?: string;
      referenceType?: string;
      referenceId?: string;
    },
  ): Promise<InventoryResponseDto> {
    await this.lockInventory(tx, productId);
    const inventory = await this.getOrCreateLocked(tx, productId);
    if (inventory.reservedQuantity < quantity) {
      throw new ConflictException('Cannot release more than reserved stock');
    }

    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: { reservedQuantity: inventory.reservedQuantity - quantity },
    });

    await tx.inventoryTransaction.create({
      data: {
        productId,
        inventoryId: inventory.id,
        type: InventoryTransactionType.RELEASE,
        quantity,
        previousQuantity: inventory.reservedQuantity,
        newQuantity: updated.reservedQuantity,
        note: options?.note,
        createdBy: options?.createdBy,
        referenceType: options?.referenceType,
        referenceId: options?.referenceId,
      },
    });

    return this.toResponse(updated);
  }

  /**
   * Converts a prior RESERVATION into a SALE:
   * quantity -= sold, reservedQuantity -= sold.
   * Caller must hold/own the surrounding order transaction; this locks inventory.
   * Idempotent when referenceType+referenceId are provided (checks under row lock).
   */
  async commitSaleInTransaction(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number,
    options?: {
      note?: string;
      createdBy?: string;
      referenceType?: string;
      referenceId?: string;
    },
  ): Promise<InventoryResponseDto> {
    if (quantity <= 0) {
      throw new ConflictException('Sale quantity must be positive');
    }

    await this.lockInventory(tx, productId);

    if (options?.referenceType && options?.referenceId) {
      const existingSale = await tx.inventoryTransaction.findFirst({
        where: {
          productId,
          type: InventoryTransactionType.SALE,
          referenceType: options.referenceType,
          referenceId: options.referenceId,
        },
      });
      if (existingSale) {
        const current = await this.getOrCreateLocked(tx, productId);
        return this.toResponse(current);
      }
    }

    const inventory = await this.getOrCreateLocked(tx, productId);

    if (inventory.reservedQuantity < quantity) {
      throw new ConflictException(
        'Cannot commit sale for more than reserved stock',
      );
    }
    if (inventory.quantity < quantity) {
      throw new ConflictException('Insufficient stock');
    }

    const nextQuantity = inventory.quantity - quantity;
    const nextReserved = inventory.reservedQuantity - quantity;
    if (nextQuantity < 0 || nextReserved < 0) {
      throw new ConflictException('Insufficient stock');
    }
    if (nextReserved > nextQuantity) {
      throw new ConflictException(
        'Reserved quantity cannot exceed on-hand quantity',
      );
    }

    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        quantity: nextQuantity,
        reservedQuantity: nextReserved,
      },
    });

    try {
      await tx.inventoryTransaction.create({
        data: {
          productId,
          inventoryId: inventory.id,
          type: InventoryTransactionType.SALE,
          quantity,
          previousQuantity: inventory.quantity,
          newQuantity: nextQuantity,
          note: options?.note,
          createdBy: options?.createdBy,
          referenceType: options?.referenceType,
          referenceId: options?.referenceId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Unique race: another txn committed the same SALE first — abort this txn's
        // inventory update by throwing so the outer transaction rolls back.
        throw new ConflictException(
          'Sale already committed for this order item',
        );
      }
      throw error;
    }

    return this.toResponse(updated);
  }

  /**
   * POS / günlük satış: decrease on-hand from available stock (no prior reservation).
   * available = quantity - reservedQuantity must be >= sold qty.
   * Idempotent when referenceType+referenceId are provided.
   */
  async sellAvailableInTransaction(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number,
    options?: {
      note?: string;
      createdBy?: string;
      referenceType?: string;
      referenceId?: string;
    },
  ): Promise<InventoryResponseDto> {
    if (quantity <= 0) {
      throw new ConflictException('Sale quantity must be positive');
    }

    await this.lockInventory(tx, productId);

    if (options?.referenceType && options?.referenceId) {
      const existingSale = await tx.inventoryTransaction.findFirst({
        where: {
          productId,
          type: InventoryTransactionType.SALE,
          referenceType: options.referenceType,
          referenceId: options.referenceId,
        },
      });
      if (existingSale) {
        const current = await this.getOrCreateLocked(tx, productId);
        return this.toResponse(current);
      }
    }

    const inventory = await this.getOrCreateLocked(tx, productId);
    const available = inventory.quantity - inventory.reservedQuantity;
    if (available < quantity) {
      throw new ConflictException('Insufficient stock');
    }

    const nextQuantity = inventory.quantity - quantity;
    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantity: nextQuantity },
    });

    try {
      await tx.inventoryTransaction.create({
        data: {
          productId,
          inventoryId: inventory.id,
          type: InventoryTransactionType.SALE,
          quantity,
          previousQuantity: inventory.quantity,
          newQuantity: nextQuantity,
          note: options?.note,
          createdBy: options?.createdBy,
          referenceType: options?.referenceType,
          referenceId: options?.referenceId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Sale already committed for this item');
      }
      throw error;
    }

    return this.toResponse(updated);
  }

  /**
   * Restocks on-hand quantity after a return (post-SALE).
   * quantity += returned; reservedQuantity unchanged.
   * Idempotent when referenceType+referenceId are provided (checks under row lock).
   */
  async commitReturnInTransaction(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number,
    options?: {
      note?: string;
      createdBy?: string;
      referenceType?: string;
      referenceId?: string;
    },
  ): Promise<InventoryResponseDto> {
    if (quantity <= 0) {
      throw new ConflictException('Return quantity must be positive');
    }

    await this.lockInventory(tx, productId);

    if (options?.referenceType && options?.referenceId) {
      const existingReturn = await tx.inventoryTransaction.findFirst({
        where: {
          productId,
          type: InventoryTransactionType.RETURN,
          referenceType: options.referenceType,
          referenceId: options.referenceId,
        },
      });
      if (existingReturn) {
        const current = await this.getOrCreateLocked(tx, productId);
        return this.toResponse(current);
      }
    }

    const inventory = await this.getOrCreateLocked(tx, productId);
    const nextQuantity = inventory.quantity + quantity;

    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantity: nextQuantity },
    });

    try {
      await tx.inventoryTransaction.create({
        data: {
          productId,
          inventoryId: inventory.id,
          type: InventoryTransactionType.RETURN,
          quantity,
          previousQuantity: inventory.quantity,
          newQuantity: nextQuantity,
          note: options?.note,
          createdBy: options?.createdBy,
          referenceType: options?.referenceType,
          referenceId: options?.referenceId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Return already committed for this order item',
        );
      }
      throw error;
    }

    return this.toResponse(updated);
  }

  private async mutateStock(input: {
    productId: string;
    delta: number;
    type: InventoryTransactionType;
    note?: string;
    createdBy?: string;
  }): Promise<InventoryResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockInventory(tx, input.productId);
      const inventory = await this.getOrCreateLocked(tx, input.productId);
      const nextQuantity = inventory.quantity + input.delta;

      if (nextQuantity < 0) {
        throw new ConflictException('Insufficient stock');
      }
      if (nextQuantity < inventory.reservedQuantity) {
        throw new ConflictException(
          'Stock cannot fall below reserved quantity',
        );
      }

      const updated = await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity: nextQuantity },
      });

      await tx.inventoryTransaction.create({
        data: {
          productId: input.productId,
          inventoryId: inventory.id,
          type: input.type,
          quantity: Math.abs(input.delta),
          previousQuantity: inventory.quantity,
          newQuantity: nextQuantity,
          note: input.note,
          createdBy: input.createdBy,
        },
      });

      return this.toResponse(updated);
    });
  }

  private async lockInventory(
    tx: Prisma.TransactionClient,
    productId: string,
  ): Promise<void> {
    await tx.$queryRaw`
      SELECT id
      FROM inventories
      WHERE "productId" = ${productId}::uuid
      FOR UPDATE
    `;
  }

  private async getOrCreateLocked(
    tx: Prisma.TransactionClient,
    productId: string,
  ): Promise<InventoryRow> {
    const existing = await tx.inventory.findUnique({ where: { productId } });
    if (existing) {
      return existing;
    }

    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return tx.inventory.create({
      data: {
        productId,
        quantity: 0,
        reservedQuantity: 0,
        minimumQuantity: 0,
      },
    });
  }
}
