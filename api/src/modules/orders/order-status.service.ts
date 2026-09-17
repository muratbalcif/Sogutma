import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryTransactionType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ShippingStatus,
} from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { AccountingService } from '../payments/accounting.service';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURNED]: [],
};

const CUSTOMER_CANCELLABLE: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
];

export type OrderTransitionResult = {
  orderId: string;
  userId: string;
  orderNumber: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
};

export type ApplyTransitionInput = {
  orderId: string;
  toStatus: OrderStatus;
  note?: string | null;
  /** null = system actor */
  changedByUserId?: string | null;
  /** When customer cancels, enforce ownership + cancellable statuses */
  customerCancel?: boolean;
  requireOwnerUserId?: string;
  /** Cancel pending payments when order is cancelled */
  cancelPendingPayments?: boolean;
  returnReason?: string | null;
  adminReturnNote?: string | null;
};

@Injectable()
export class OrderStatusService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly accountingService: AccountingService,
  ) {}

  canCustomerCancel(status: OrderStatus): boolean {
    return CUSTOMER_CANCELLABLE.includes(status);
  }

  assertTransition(from: OrderStatus, to: OrderStatus): void {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}`,
      );
    }
  }

  getAllowedTransitions(from: OrderStatus): OrderStatus[] {
    return [...(ALLOWED_TRANSITIONS[from] ?? [])];
  }

  /**
   * Single path for order status changes inside an existing DB transaction.
   * Handles validation, history, inventory release (cancel), shipping sync,
   * and return foundation rows.
   */
  async applyTransitionInTransaction(
    tx: Prisma.TransactionClient,
    input: ApplyTransitionInput,
  ): Promise<OrderTransitionResult> {
    await tx.$queryRaw`
      SELECT id FROM orders WHERE id = ${input.orderId}::uuid FOR UPDATE
    `;

    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { items: true, shipping: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (input.requireOwnerUserId && order.userId !== input.requireOwnerUserId) {
      throw new ForbiddenException('Order does not belong to user');
    }

    if (order.status === input.toStatus) {
      throw new ConflictException(`Order is already ${input.toStatus}`);
    }

    if (input.customerCancel) {
      if (!this.canCustomerCancel(order.status)) {
        throw new ConflictException(
          `Order cannot be cancelled from status ${order.status}`,
        );
      }
      if (input.toStatus !== OrderStatus.CANCELLED) {
        throw new BadRequestException('Customer cancel must target CANCELLED');
      }
    } else {
      this.assertTransition(order.status, input.toStatus);
    }

    if (input.toStatus === OrderStatus.CANCELLED) {
      const paidPayment = await tx.payment.findFirst({
        where: { orderId: order.id, status: PaymentStatus.PAID },
        select: { id: true },
      });
      if (paidPayment) {
        throw new ConflictException(
          'Paid orders cannot be cancelled; use refund flow',
        );
      }

      await this.releaseOrderStockOnce(tx, order.id, input.changedByUserId);
      await this.accountingService.reverseSaleForCancelledOrder({
        tx,
        userId: order.userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        actorUserId: input.changedByUserId ?? null,
      });
      if (input.cancelPendingPayments !== false) {
        await tx.payment.updateMany({
          where: { orderId: order.id, status: PaymentStatus.PENDING },
          data: {
            status: PaymentStatus.CANCELLED,
            failureCode: 'ORDER_CANCELLED',
            failureMessage: 'Order cancelled',
          },
        });
      }
      if (order.shipping) {
        await tx.shipping.update({
          where: { orderId: order.id },
          data: { status: ShippingStatus.CANCELLED },
        });
      }
    }

    if (input.toStatus === OrderStatus.DELIVERED && order.shipping) {
      await tx.shipping.update({
        where: { orderId: order.id },
        data: {
          status: ShippingStatus.DELIVERED,
          deliveredAt: order.shipping.deliveredAt ?? new Date(),
        },
      });
    }

    if (input.toStatus === OrderStatus.RETURNED) {
      if (order.shipping) {
        await tx.shipping.update({
          where: { orderId: order.id },
          data: { status: ShippingStatus.RETURNED },
        });
      }
      await tx.orderReturn.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          returnReason: input.returnReason ?? null,
          adminNote: input.adminReturnNote ?? null,
          createdByUserId: input.changedByUserId ?? null,
        },
        update: {
          returnReason: input.returnReason ?? undefined,
          adminNote: input.adminReturnNote ?? undefined,
        },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: input.toStatus },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: input.toStatus,
        note: input.note ?? null,
        changedBy: input.changedByUserId ?? null,
      },
    });

    return {
      orderId: order.id,
      userId: order.userId,
      orderNumber: order.orderNumber,
      fromStatus: order.status,
      toStatus: input.toStatus,
    };
  }

  /**
   * Idempotent reservation release for an order.
   * Skips products that already have a RELEASE movement for this order.
   */
  async releaseOrderStockOnce(
    tx: Prisma.TransactionClient,
    orderId: string,
    actorUserId?: string | null,
  ): Promise<void> {
    const items = await tx.orderItem.findMany({
      where: { orderId, productId: { not: null } },
    });

    for (const item of items) {
      if (!item.productId) {
        continue;
      }

      const alreadyReleased = await tx.inventoryTransaction.findFirst({
        where: {
          productId: item.productId,
          referenceType: 'ORDER',
          referenceId: orderId,
          type: InventoryTransactionType.RELEASE,
        },
      });
      if (alreadyReleased) {
        continue;
      }

      await this.inventoryService.releaseStockInTransaction(
        tx,
        item.productId,
        item.quantity,
        {
          createdBy: actorUserId ?? undefined,
          referenceType: 'ORDER',
          referenceId: orderId,
          note: 'Released on order cancellation',
        },
      );
    }
  }
}
