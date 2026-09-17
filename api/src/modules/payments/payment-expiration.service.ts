import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderStatusService } from '../orders/order-status.service';
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
    private readonly orderStatusService: OrderStatusService,
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

      await this.orderStatusService.applyTransitionInTransaction(tx, {
        orderId: payment.orderId,
        toStatus: OrderStatus.CANCELLED,
        note: 'Cancelled: bank transfer payment expired',
        changedByUserId: null,
        cancelPendingPayments: false,
      });

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
    await this.emailOutbox.enqueueOrderEmail({
      event: 'OrderCancelled',
      toEmail: result.email,
      customerName: 'Müşterimiz',
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      status: OrderStatus.CANCELLED,
    });
    return true;
  }
}
