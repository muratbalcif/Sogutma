import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountTransactionType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import {
  PaginatedResponseDto,
  buildPaginatedResponse,
} from '../../common/dto/pagination.dto';
import { toMoneyString } from '../../common/utils/money.util';
import { OrderStatusService } from '../orders/order-status.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from './accounting.service';
import {
  AdminPaymentListQueryDto,
  CreatePaymentDto,
  PaymentResponseDto,
} from './dto/payment.dto';
import { PaymentStatusService } from './payment-status.service';
import {
  DEVELOPMENT_PAYMENT_PROVIDER,
  PaymentProvider,
} from './providers/payment-provider.interface';
import { DevelopmentPaymentProvider } from './providers/development.payment-provider';

/**
 * Business decision: when payment becomes PAID and order is PENDING,
 * order transitions to CONFIRMED (payment required before fulfillment).
 * Payment failure does NOT cancel the order.
 */
@Injectable()
export class PaymentsService {
  private readonly providers: Map<string, PaymentProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
    private readonly paymentStatusService: PaymentStatusService,
    private readonly orderStatusService: OrderStatusService,
    developmentProvider: DevelopmentPaymentProvider,
  ) {
    this.providers = new Map([[developmentProvider.name, developmentProvider]]);
  }

  async createForOrder(
    userId: string,
    orderId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ): Promise<PaymentResponseDto> {
    if (idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        if (existing.orderId !== orderId) {
          throw new ConflictException('Idempotency key already used');
        }
        return this.toResponse(existing);
      }
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { status: PaymentStatus.PAID },
          take: 1,
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Order does not belong to user');
    }
    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.RETURNED
    ) {
      throw new ConflictException('Order is not payable');
    }
    if (order.payments.length > 0) {
      throw new ConflictException('Order is already paid');
    }

    const providerName =
      dto.method === PaymentMethod.CREDIT_CARD
        ? DEVELOPMENT_PAYMENT_PROVIDER
        : null;

    try {
      const payment = await this.prisma.payment.create({
        data: {
          orderId,
          method: dto.method,
          status: PaymentStatus.PENDING,
          amount: order.totalAmount,
          currency: order.currency,
          provider: providerName,
          idempotencyKey: idempotencyKey ?? null,
        },
      });

      if (dto.method === PaymentMethod.CREDIT_CARD && providerName) {
        const provider = this.requireProvider(providerName);
        const intent = await provider.createPayment({
          paymentId: payment.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: toMoneyString(order.totalAmount),
          currency: order.currency,
          method: dto.method,
        });

        const updated = await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            providerPaymentId: intent.providerPaymentId,
            status:
              intent.status === 'FAILED'
                ? PaymentStatus.FAILED
                : intent.status === 'PAID'
                  ? PaymentStatus.PAID
                  : intent.status === 'AUTHORIZED'
                    ? PaymentStatus.AUTHORIZED
                    : PaymentStatus.PENDING,
            failureCode: intent.failureCode,
            failureMessage: intent.failureMessage,
            paidAt: intent.status === 'PAID' ? new Date() : null,
          },
        });

        if (updated.status === PaymentStatus.PAID) {
          await this.onPaymentPaid(updated.id);
          return this.getById(updated.id);
        }
        return this.toResponse(updated);
      }

      return this.toResponse(payment);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        idempotencyKey
      ) {
        const existing = await this.prisma.payment.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          return this.toResponse(existing);
        }
      }
      throw error;
    }
  }

  async getLatestForOrder(
    userId: string,
    orderId: string,
  ): Promise<PaymentResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Order does not belong to user');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return this.toResponse(payment);
  }

  async getById(paymentId: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return this.toResponse(payment);
  }

  async listAdmin(
    query: AdminPaymentListQueryDto,
  ): Promise<PaginatedResponseDto<PaymentResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.PaymentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.orderNumber
        ? { order: { orderNumber: query.orderNumber } }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return buildPaginatedResponse(
      items.map((item) => this.toResponse(item)),
      total,
      page,
      limit,
    );
  }

  async handleWebhook(
    providerName: string,
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<{ processed: boolean; paymentId?: string }> {
    const provider = this.requireProvider(providerName);
    const event = await provider.verifyWebhook({ headers, rawBody: body });

    const existingEvent = await this.prisma.processedWebhookEvent.findUnique({
      where: {
        provider_eventKey: {
          provider: providerName,
          eventKey: event.eventKey,
        },
      },
    });
    if (existingEvent) {
      return {
        processed: false,
        paymentId: existingEvent.paymentId ?? undefined,
      };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { providerPaymentId: event.providerPaymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found for webhook');
    }

    const targetStatus = this.mapProviderStatus(event.status);
    await this.applyPaymentStatus(payment.id, targetStatus, {
      webhook: { provider: providerName, eventKey: event.eventKey },
    });

    return { processed: true, paymentId: payment.id };
  }

  async refundPayment(paymentId: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status === PaymentStatus.REFUNDED) {
      return this.toResponse(payment);
    }
    this.paymentStatusService.assertTransition(
      payment.status,
      PaymentStatus.REFUNDED,
    );

    if (payment.provider && payment.providerPaymentId) {
      const provider = this.requireProvider(payment.provider);
      await provider.refundPayment(
        payment.providerPaymentId,
        toMoneyString(payment.amount),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.REFUNDED },
      });
      await this.accountingService.recordIfAbsent({
        tx,
        userId: payment.order.userId,
        orderId: payment.orderId,
        paymentId: payment.id,
        type: AccountTransactionType.REFUND,
        amount: payment.amount,
        currency: payment.currency,
        description: `Refund for payment ${payment.id}`,
        reference: `REFUND:PAYMENT:${payment.id}`,
      });
    });

    return this.getById(paymentId);
  }

  async markPaidFromBankTransfer(
    paymentId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status === PaymentStatus.PAID) {
      return;
    }
    this.paymentStatusService.assertTransition(
      payment.status,
      PaymentStatus.PAID,
    );

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PAID, paidAt: new Date() },
    });

    await this.syncOrderOnPaid(tx, payment.orderId, payment.order.userId);
    await this.accountingService.recordIfAbsent({
      tx,
      userId: payment.order.userId,
      orderId: payment.orderId,
      paymentId: payment.id,
      type: AccountTransactionType.PAYMENT,
      amount: payment.amount,
      currency: payment.currency,
      description: `Payment received for order ${payment.order.orderNumber}`,
      reference: `PAYMENT:${payment.id}`,
    });
  }

  async markFailedFromBankTransfer(
    paymentId: string,
    reason: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (
      payment.status === PaymentStatus.FAILED ||
      payment.status === PaymentStatus.PAID
    ) {
      return;
    }
    this.paymentStatusService.assertTransition(
      payment.status,
      PaymentStatus.FAILED,
    );
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.FAILED,
        failureCode: 'BANK_TRANSFER_REJECTED',
        failureMessage: reason,
      },
    });
  }

  private async applyPaymentStatus(
    paymentId: string,
    toStatus: PaymentStatus,
    options?: {
      webhook?: { provider: string; eventKey: string };
    },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (options?.webhook) {
        try {
          await tx.processedWebhookEvent.create({
            data: {
              provider: options.webhook.provider,
              eventKey: options.webhook.eventKey,
              paymentId,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            return;
          }
          throw error;
        }
      }

      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { order: true },
      });
      if (!payment) {
        throw new NotFoundException('Payment not found');
      }
      if (payment.status === toStatus) {
        return;
      }
      this.paymentStatusService.assertTransition(payment.status, toStatus);

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: toStatus,
          paidAt: toStatus === PaymentStatus.PAID ? new Date() : payment.paidAt,
          failureCode:
            toStatus === PaymentStatus.FAILED
              ? 'PROVIDER_FAILED'
              : payment.failureCode,
          failureMessage:
            toStatus === PaymentStatus.FAILED
              ? 'Provider reported failure'
              : payment.failureMessage,
        },
      });

      if (toStatus === PaymentStatus.PAID) {
        await this.syncOrderOnPaid(tx, payment.orderId, payment.order.userId);
        await this.accountingService.recordIfAbsent({
          tx,
          userId: payment.order.userId,
          orderId: payment.orderId,
          paymentId: payment.id,
          type: AccountTransactionType.PAYMENT,
          amount: payment.amount,
          currency: payment.currency,
          description: `Payment received for order ${payment.order.orderNumber}`,
          reference: `PAYMENT:${payment.id}`,
        });
      }
    });
  }

  private async onPaymentPaid(paymentId: string): Promise<void> {
    await this.applyPaymentStatus(paymentId, PaymentStatus.PAID);
  }

  private async syncOrderOnPaid(
    tx: Prisma.TransactionClient,
    orderId: string,
    changedBy: string,
  ): Promise<void> {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return;
    }
    if (order.status !== OrderStatus.PENDING) {
      return;
    }
    this.orderStatusService.assertTransition(
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
    );
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CONFIRMED },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: OrderStatus.PENDING,
        toStatus: OrderStatus.CONFIRMED,
        note: 'Confirmed after successful payment',
        changedBy,
      },
    });
  }

  private mapProviderStatus(
    status: 'PAID' | 'FAILED' | 'AUTHORIZED' | 'CANCELLED' | 'REFUNDED',
  ): PaymentStatus {
    switch (status) {
      case 'PAID':
        return PaymentStatus.PAID;
      case 'FAILED':
        return PaymentStatus.FAILED;
      case 'AUTHORIZED':
        return PaymentStatus.AUTHORIZED;
      case 'CANCELLED':
        return PaymentStatus.CANCELLED;
      case 'REFUNDED':
        return PaymentStatus.REFUNDED;
      default:
        throw new BadRequestException('Unsupported provider status');
    }
  }

  private requireProvider(name: string): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new BadRequestException(`Unknown payment provider: ${name}`);
    }
    return provider;
  }

  private toResponse(payment: {
    id: string;
    orderId: string;
    method: PaymentMethod;
    status: PaymentStatus;
    amount: Prisma.Decimal;
    currency: string;
    provider: string | null;
    providerPaymentId: string | null;
    idempotencyKey: string | null;
    failureCode: string | null;
    failureMessage: string | null;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PaymentResponseDto {
    return {
      id: payment.id,
      orderId: payment.orderId,
      method: payment.method,
      status: payment.status,
      amount: toMoneyString(payment.amount),
      currency: payment.currency,
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      idempotencyKey: payment.idempotencyKey,
      failureCode: payment.failureCode,
      failureMessage: payment.failureMessage,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
