import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountTransactionType,
  BankTransferStatus,
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
import { EnvironmentVariables } from '../../config/env.validation';
import { OrderStatusService } from '../orders/order-status.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from './accounting.service';
import {
  AdminPaymentListQueryDto,
  CreatePaymentDto,
  PaymentResponseDto,
} from './dto/payment.dto';
import { buildPaymentReference } from './payment-reference.util';
import { PaymentStatusService } from './payment-status.service';
import { PaymentProvider } from './providers/payment-provider.interface';
import { DevelopmentPaymentProvider } from './providers/development.payment-provider';

/**
 * v1 active provider path: BANK_TRANSFER only.
 * Online provider abstraction is retained for a future release but not activated.
 * When payment becomes PAID and order is PENDING, order → CONFIRMED.
 * Payment failure/rejection does NOT cancel the order.
 */
@Injectable()
export class PaymentsService {
  private readonly providers: Map<string, PaymentProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
    private readonly paymentStatusService: PaymentStatusService,
    private readonly orderStatusService: OrderStatusService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    developmentProvider: DevelopmentPaymentProvider,
  ) {
    this.providers = new Map([[developmentProvider.name, developmentProvider]]);
  }

  paymentExpiryDate(from = new Date()): Date {
    const hours =
      this.config.get('PAYMENT_EXPIRY_HOURS', { infer: true }) ?? 24;
    return new Date(from.getTime() + hours * 60 * 60 * 1000);
  }

  async createForOrder(
    userId: string,
    orderId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ): Promise<PaymentResponseDto> {
    if (dto.method !== PaymentMethod.BANK_TRANSFER) {
      throw new BadRequestException(
        'Only BANK_TRANSFER is supported in the current release',
      );
    }

    if (idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        if (existing.orderId !== orderId) {
          throw new ConflictException('Idempotency key already used');
        }
        return this.toResponseAsync(existing);
      }
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
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
    if (order.payments.some((p) => p.status === PaymentStatus.PAID)) {
      throw new ConflictException('Order is already paid');
    }

    const existingOpen = order.payments.find(
      (p) =>
        p.method === PaymentMethod.BANK_TRANSFER &&
        (p.status === PaymentStatus.PENDING ||
          p.status === PaymentStatus.PARTIALLY_PAID),
    );
    if (existingOpen) {
      return this.toResponseAsync(existingOpen);
    }

    try {
      const payment = await this.prisma.payment.create({
        data: {
          orderId,
          method: PaymentMethod.BANK_TRANSFER,
          status: PaymentStatus.PENDING,
          amount: order.totalAmount,
          currency: order.currency,
          provider: null,
          idempotencyKey: idempotencyKey ?? null,
          expiresAt: this.paymentExpiryDate(),
          paymentReference: buildPaymentReference(order.orderNumber),
        },
      });
      return this.toResponseAsync(payment);
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
          return this.toResponseAsync(existing);
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
    return this.toResponseAsync(payment);
  }

  async getById(paymentId: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    const pendingBankTransferId = await this.findPendingBankTransferId(
      payment.id,
      payment.method,
      payment.status,
    );
    return this.toResponseAsync(payment, pendingBankTransferId);
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

    const pendingIds = await this.mapPendingBankTransferIds(items);

    return buildPaginatedResponse(
      items.map((item) =>
        this.toResponse(item, pendingIds.get(item.id) ?? null),
      ),
      total,
      page,
      limit,
    );
  }

  handleWebhook(
    providerName: string,
    _headers: Record<string, string | string[] | undefined>,
    _body: unknown,
  ): Promise<{ processed: boolean; paymentId?: string }> {
    void _headers;
    void _body;
    return Promise.reject(
      new BadRequestException(
        `Online payment provider "${providerName}" is not enabled in this release`,
      ),
    );
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
        referenceType: 'REFUND',
        referenceId: payment.id,
      });
    });

    return this.getById(paymentId);
  }

  /**
   * Apply an approved bank-transfer notification as a partial or full payment.
   * Caller must already hold row locks and have set the notification to APPROVED.
   * Ledger credit uses notification.amount with reference PAYMENT:BANK_TRANSFER:{id}.
   */
  async applyApprovedBankTransfer(
    input: {
      paymentId: string;
      notificationId: string;
      notificationAmount: Prisma.Decimal;
      orderId: string;
      orderTotal: Prisma.Decimal;
      userId: string;
      currency: string;
      orderNumber: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<{ fullyPaid: boolean; approvedTotal: Prisma.Decimal }> {
    await tx.$queryRaw`
      SELECT id FROM payments WHERE id = ${input.paymentId}::uuid FOR UPDATE
    `;

    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status === PaymentStatus.PAID) {
      const approved = await this.sumApprovedTransfers(
        tx,
        input.orderId,
      );
      return { fullyPaid: true, approvedTotal: approved };
    }

    await this.accountingService.recordIfAbsent({
      tx,
      userId: input.userId,
      orderId: input.orderId,
      paymentId: input.paymentId,
      type: AccountTransactionType.PAYMENT,
      amount: input.notificationAmount,
      currency: input.currency,
      description: `Bank transfer ${input.notificationId} for order ${input.orderNumber}`,
      reference: `PAYMENT:BANK_TRANSFER:${input.notificationId}`,
      referenceType: 'BANK_TRANSFER',
      referenceId: input.notificationId,
    });

    const approvedTotal = await this.sumApprovedTransfers(tx, input.orderId);
    const fullyPaid = approvedTotal.gte(input.orderTotal);

    if (fullyPaid) {
      this.paymentStatusService.assertTransition(
        payment.status,
        PaymentStatus.PAID,
      );
      await tx.payment.update({
        where: { id: input.paymentId },
        data: { status: PaymentStatus.PAID, paidAt: new Date() },
      });
      await this.syncOrderOnPaid(tx, input.orderId, input.userId);
    } else if (payment.status !== PaymentStatus.PARTIALLY_PAID) {
      this.paymentStatusService.assertTransition(
        payment.status,
        PaymentStatus.PARTIALLY_PAID,
      );
      await tx.payment.update({
        where: { id: input.paymentId },
        data: { status: PaymentStatus.PARTIALLY_PAID, paidAt: null },
      });
    }

    return { fullyPaid, approvedTotal };
  }

  /** @deprecated Use applyApprovedBankTransfer for partial-aware flow */
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
    await this.applyApprovedBankTransfer(
      {
        paymentId,
        notificationId: paymentId,
        notificationAmount: payment.amount,
        orderId: payment.orderId,
        orderTotal: payment.order.totalAmount,
        userId: payment.order.userId,
        currency: payment.currency,
        orderNumber: payment.order.orderNumber,
      },
      tx,
    );
  }

  async sumApprovedTransfers(
    client: Prisma.TransactionClient | PrismaService,
    orderId: string,
  ): Promise<Prisma.Decimal> {
    const agg = await client.bankTransferNotification.aggregate({
      where: { orderId, status: BankTransferStatus.APPROVED },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? new Prisma.Decimal(0);
  }

  remainingFrom(orderTotal: Prisma.Decimal, approvedTotal: Prisma.Decimal) {
    const remaining = orderTotal.sub(approvedTotal);
    return remaining.lt(0) ? new Prisma.Decimal(0) : remaining;
  }

  /**
   * Rejection keeps payment PENDING/PARTIALLY_PAID so the customer can resubmit.
   * Order stays PENDING (never auto-cancelled).
   */
  async markRejectedKeepPending(
    paymentId: string,
    reason: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status === PaymentStatus.PAID) {
      throw new ConflictException('Paid payment cannot be rejected');
    }
    if (
      payment.status === PaymentStatus.PENDING ||
      payment.status === PaymentStatus.PARTIALLY_PAID
    ) {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          failureCode: 'BANK_TRANSFER_REJECTED',
          failureMessage: reason,
        },
      });
    }
  }

  /** @deprecated Prefer markRejectedKeepPending for v1 bank-transfer flow */
  async markFailedFromBankTransfer(
    paymentId: string,
    reason: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await this.markRejectedKeepPending(paymentId, reason, tx);
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
    await this.orderStatusService.applyTransitionInTransaction(tx, {
      orderId,
      toStatus: OrderStatus.CONFIRMED,
      note: 'Confirmed after successful payment',
      changedByUserId: changedBy,
      cancelPendingPayments: false,
    });
  }

  private requireProvider(name: string): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new BadRequestException(`Unknown payment provider: ${name}`);
    }
    return provider;
  }

  private async findPendingBankTransferId(
    paymentId: string,
    method: PaymentMethod,
    status: PaymentStatus,
  ): Promise<string | null> {
    if (
      method !== PaymentMethod.BANK_TRANSFER ||
      (status !== PaymentStatus.PENDING &&
        status !== PaymentStatus.PARTIALLY_PAID)
    ) {
      return null;
    }
    const notification = await this.prisma.bankTransferNotification.findFirst({
      where: { paymentId, status: BankTransferStatus.PENDING },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return notification?.id ?? null;
  }

  private async mapPendingBankTransferIds(
    items: Array<{
      id: string;
      method: PaymentMethod;
      status: PaymentStatus;
    }>,
  ): Promise<Map<string, string>> {
    const pendingPaymentIds = items
      .filter(
        (item) =>
          item.method === PaymentMethod.BANK_TRANSFER &&
          (item.status === PaymentStatus.PENDING ||
            item.status === PaymentStatus.PARTIALLY_PAID),
      )
      .map((item) => item.id);
    if (pendingPaymentIds.length === 0) {
      return new Map();
    }
    const notifications =
      await this.prisma.bankTransferNotification.findMany({
        where: {
          paymentId: { in: pendingPaymentIds },
          status: BankTransferStatus.PENDING,
        },
        select: { id: true, paymentId: true },
        orderBy: { createdAt: 'desc' },
      });
    const map = new Map<string, string>();
    for (const row of notifications) {
      if (!map.has(row.paymentId)) {
        map.set(row.paymentId, row.id);
      }
    }
    return map;
  }

  private async toResponseAsync(
    payment: {
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
      expiresAt?: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    pendingBankTransferId: string | null = null,
  ): Promise<PaymentResponseDto> {
    const approvedTotal = await this.sumApprovedTransfers(
      this.prisma,
      payment.orderId,
    );
    const remaining = this.remainingFrom(payment.amount, approvedTotal);
    return {
      ...this.toResponse(payment, pendingBankTransferId),
      approvedTotal: toMoneyString(approvedTotal),
      remainingAmount: toMoneyString(remaining),
    };
  }

  private toResponse(
    payment: {
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
      expiresAt?: Date | null;
      paymentReference?: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    pendingBankTransferId: string | null = null,
  ): PaymentResponseDto {
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
      expiresAt: payment.expiresAt ?? null,
      pendingBankTransferId,
      paymentReference: payment.paymentReference ?? null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
