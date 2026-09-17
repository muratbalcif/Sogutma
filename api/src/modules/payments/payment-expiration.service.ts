import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailOutboxService } from './email-outbox.service';

/**
 * Idempotent expiry of PENDING bank-transfer payments past expiresAt.
 * Cancels payment + order and releases reserved stock once.
 */
@Injectable()
export class PaymentExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentExpirationService.name);
  private running = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly notificationsService: NotificationsService,
    private readonly emailOutbox: EmailOutboxService,
  ) {}

  onModuleInit(): void {
    // Every 10 minutes; safe to call concurrently thanks to running guard.
    this.timer = setInterval(
      () => {
        void this.expirePendingPayments();
      },
      10 * 60 * 1000,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async expirePendingPayments(now = new Date()): Promise<number> {
    if (this.running) {
      return 0;
    }
    this.running = true;
    let expired = 0;
    try {
      const candidates = await this.prisma.payment.findMany({
        where: {
          method: PaymentMethod.BANK_TRANSFER,
          status: PaymentStatus.PENDING,
          expiresAt: { lt: now },
        },
        select: { id: true },
        take: 50,
      });

      for (const candidate of candidates) {
        const didExpire = await this.expireOne(candidate.id);
        if (didExpire) {
          expired += 1;
        }
      }
      if (expired > 0) {
        this.logger.log(`Expired ${expired} pending bank-transfer payment(s)`);
      }
      return expired;
    } finally {
      this.running = false;
    }
  }

  private async expireOne(paymentId: string): Promise<boolean> {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE
      `;
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          order: {
            include: {
              items: true,
              user: { select: { id: true, email: true } },
            },
          },
        },
      });
      if (!payment) {
        return null;
      }
      if (payment.status !== PaymentStatus.PENDING) {
        return null;
      }
      if (!payment.expiresAt || payment.expiresAt.getTime() >= Date.now()) {
        return null;
      }
      if (payment.order.status === OrderStatus.CANCELLED) {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.CANCELLED,
            failureCode: 'PAYMENT_EXPIRED',
            failureMessage: 'Payment window expired',
          },
        });
        return null;
      }
      if (payment.order.status !== OrderStatus.PENDING) {
        return null;
      }

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.CANCELLED,
          failureCode: 'PAYMENT_EXPIRED',
          failureMessage: 'Payment window expired',
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.CANCELLED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.CANCELLED,
          note: 'Cancelled: bank transfer payment expired',
          changedBy: null,
        },
      });

      for (const item of payment.order.items) {
        if (!item.productId) {
          continue;
        }
        await this.inventoryService.releaseStockInTransaction(
          tx,
          item.productId,
          item.quantity,
          {
            createdBy: payment.order.userId,
            referenceType: 'ORDER',
            referenceId: payment.orderId,
            note: 'Released on payment expiry',
          },
        );
      }

      return {
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        userId: payment.order.userId,
        email: payment.order.user.email,
      };
    });

    if (!result) {
      return false;
    }

    await this.notificationsService.enqueueOrderStatus(
      result.orderId,
      result.userId,
      OrderStatus.CANCELLED,
      result.orderNumber,
    );
    await this.emailOutbox.enqueue({
      event: 'OrderCancelled',
      toEmail: result.email,
      subject: `Sipariş iptal edildi — ${result.orderNumber}`,
      payload: {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        reason: 'PAYMENT_EXPIRED',
      },
    });
    return true;
  }
}
