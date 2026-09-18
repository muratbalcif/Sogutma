import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
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
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { BankAccountsService } from './bank-accounts.service';
import {
  AdminBankTransferListQueryDto,
  BankTransferResponseDto,
  BankTransferTimelineItemDto,
  CreateBankTransferDto,
} from './dto/payment.dto';
import { EmailOutboxService } from './email-outbox.service';
import { buildPaymentReference } from './payment-reference.util';
import { PaymentsService } from './payments.service';

/**
 * Bank transfer rejection keeps Payment PENDING/PARTIALLY_PAID so the customer can resubmit.
 * Order is never auto-cancelled on reject.
 * Approval is idempotent: repeated approve on APPROVED returns current state.
 * Partial payments: each APPROVED notification credits notification.amount.
 *
 * Claim UX: customer selects a company bank account and confirms transfer
 * ("Ödemeyi Yaptım"). referenceNumber is locked to Payment.paymentReference.
 */
@Injectable()
export class BankTransferService {
  private readonly logger = new Logger(BankTransferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly bankAccountsService: BankAccountsService,
    private readonly emailOutbox: EmailOutboxService,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService?: NotificationsService,
  ) {}

  async createNotification(
    userId: string,
    orderId: string,
    dto: CreateBankTransferDto,
  ): Promise<BankTransferResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        payments: {
          where: { method: PaymentMethod.BANK_TRANSFER },
          orderBy: { createdAt: 'desc' },
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

    let payment = order.payments[0];
    if (!payment || payment.method !== PaymentMethod.BANK_TRANSFER) {
      throw new ConflictException(
        'Create a BANK_TRANSFER payment before submitting a notification',
      );
    }
    if (payment.status === PaymentStatus.PAID) {
      throw new ConflictException('Order is already paid');
    }
    if (
      payment.status === PaymentStatus.CANCELLED ||
      payment.status === PaymentStatus.REFUNDED
    ) {
      throw new ConflictException('Payment is no longer payable');
    }

    const pending = await this.prisma.bankTransferNotification.findFirst({
      where: { orderId, status: BankTransferStatus.PENDING },
    });
    if (pending) {
      throw new ConflictException(
        'Bu sipariş için zaten bekleyen bir havale bildiriminiz bulunuyor.',
      );
    }

    if (!dto.bankAccountId) {
      throw new BadRequestException('bankAccountId is required');
    }
    await this.bankAccountsService.requireActive(dto.bankAccountId);

    const approvedTotal = await this.paymentsService.sumApprovedTransfers(
      this.prisma,
      orderId,
    );
    const remaining = this.paymentsService.remainingFrom(
      order.totalAmount,
      approvedTotal,
    );
    if (remaining.lte(0)) {
      throw new ConflictException('Order is already paid');
    }

    const reportedAmount = dto.amount
      ? new Prisma.Decimal(dto.amount)
      : remaining;
    if (reportedAmount.lte(0)) {
      throw new BadRequestException('Transfer amount must be positive');
    }
    if (reportedAmount.gt(remaining)) {
      throw new BadRequestException(
        `Transfer amount exceeds remaining balance (${toMoneyString(remaining)})`,
      );
    }
    const amountMismatch = !reportedAmount.equals(remaining);

    let paymentReference = payment.paymentReference;
    if (!paymentReference) {
      paymentReference = buildPaymentReference(order.orderNumber);
      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { paymentReference },
      });
    }

    const senderName =
      dto.senderName?.trim() ||
      `${order.user.firstName} ${order.user.lastName}`.trim() ||
      'Müşteri';
    const transferDate = dto.transferDate
      ? new Date(dto.transferDate)
      : new Date();

    const created = await this.prisma.bankTransferNotification.create({
      data: {
        orderId,
        userId,
        paymentId: payment.id,
        bankAccountId: dto.bankAccountId,
        amount: reportedAmount,
        currency: order.currency,
        amountMismatch,
        senderName,
        senderIban: dto.senderIban?.toUpperCase(),
        transferDate,
        referenceNumber: paymentReference,
        note: dto.note,
        status: BankTransferStatus.PENDING,
      },
      include: this.detailInclude,
    });

    await this.notificationsService?.enqueuePaymentEvent({
      userId,
      type: 'BANK_TRANSFER_SUBMITTED',
      title: 'Ödeme bildiriminiz alındı',
      body: `${order.orderNumber} için havale bildiriminiz incelenecek.`,
      data: { orderId, transferId: created.id },
    });
    await this.emailOutbox.enqueue({
      event: 'TransferNotificationCreated',
      toEmail: order.user.email,
      subject: `Havale bildirimi alındı — ${order.orderNumber}`,
      payload: {
        orderId,
        orderNumber: order.orderNumber,
        transferId: created.id,
        amount: toMoneyString(reportedAmount),
        amountMismatch,
        remainingAmount: toMoneyString(remaining),
        paymentReference,
        bankAccountId: dto.bankAccountId,
      },
    });

    return this.toResponseFull(created);
  }

  async getForOrder(
    userId: string,
    orderId: string,
  ): Promise<BankTransferResponseDto> {
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

    const notification = await this.prisma.bankTransferNotification.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: this.detailInclude,
    });
    if (!notification) {
      throw new NotFoundException('Bank transfer notification not found');
    }
    return this.toResponseFull(notification);
  }

  async getForUserById(
    userId: string,
    id: string,
  ): Promise<BankTransferResponseDto> {
    const notification = await this.prisma.bankTransferNotification.findUnique({
      where: { id },
      include: this.detailInclude,
    });
    if (!notification) {
      throw new NotFoundException('Bank transfer notification not found');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException('Transfer does not belong to user');
    }
    return this.toResponseFull(notification);
  }

  async listForUser(
    userId: string,
    query: { page?: number; limit?: number },
  ): Promise<PaginatedResponseDto<BankTransferResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { order: { userId } };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.bankTransferNotification.count({ where }),
      this.prisma.bankTransferNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: this.detailInclude,
      }),
    ]);
    const mapped = await Promise.all(
      items.map((item) => this.toResponseFull(item)),
    );
    return buildPaginatedResponse(mapped, total, page, limit);
  }

  async listAdmin(
    query: AdminBankTransferListQueryDto,
  ): Promise<PaginatedResponseDto<BankTransferResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.BankTransferNotificationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.bankAccountId ? { bankAccountId: query.bankAccountId } : {}),
      ...(query.orderNumber
        ? { order: { orderNumber: query.orderNumber } }
        : {}),
      ...(search
        ? {
            OR: [
              {
                order: {
                  orderNumber: { contains: search, mode: 'insensitive' },
                },
              },
              { referenceNumber: { contains: search, mode: 'insensitive' } },
              {
                order: {
                  user: {
                    OR: [
                      { email: { contains: search, mode: 'insensitive' } },
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
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
      this.prisma.bankTransferNotification.count({ where }),
      this.prisma.bankTransferNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: this.detailInclude,
      }),
    ]);

    const mapped = await Promise.all(
      items.map((item) => this.toResponseFull(item)),
    );
    return buildPaginatedResponse(mapped, total, page, limit);
  }

  async getAdminById(id: string): Promise<BankTransferResponseDto> {
    const notification = await this.prisma.bankTransferNotification.findUnique({
      where: { id },
      include: this.detailInclude,
    });
    if (!notification) {
      throw new NotFoundException('Bank transfer notification not found');
    }
    return this.toResponseFull(notification, true);
  }

  async approve(
    id: string,
    adminUserId: string,
    adminNote?: string,
  ): Promise<BankTransferResponseDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM bank_transfer_notifications WHERE id = ${id}::uuid FOR UPDATE
      `;
      const notification = await tx.bankTransferNotification.findUnique({
        where: { id },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              userId: true,
              totalAmount: true,
              currency: true,
              user: { select: { email: true } },
            },
          },
          payment: { select: { id: true, status: true } },
        },
      });
      if (!notification) {
        throw new NotFoundException('Bank transfer notification not found');
      }
      if (notification.status === BankTransferStatus.APPROVED) {
        return { notification, fullyPaid: false, alreadyApproved: true };
      }
      if (notification.status === BankTransferStatus.REJECTED) {
        throw new ConflictException('Bank transfer already rejected');
      }

      await tx.$queryRaw`
        SELECT id FROM payments WHERE id = ${notification.paymentId}::uuid FOR UPDATE
      `;

      const approvedBefore = await this.paymentsService.sumApprovedTransfers(
        tx,
        notification.orderId,
      );
      const remaining = this.paymentsService.remainingFrom(
        notification.order.totalAmount,
        approvedBefore,
      );
      if (notification.amount.gt(remaining)) {
        throw new BadRequestException(
          `Overpayment: notification ${toMoneyString(notification.amount)} exceeds remaining ${toMoneyString(remaining)}`,
        );
      }

      const updated = await tx.bankTransferNotification.update({
        where: { id },
        data: {
          status: BankTransferStatus.APPROVED,
          verifiedBy: adminUserId,
          verifiedAt: new Date(),
          adminNote: adminNote ?? notification.adminNote,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              userId: true,
              totalAmount: true,
              currency: true,
              user: { select: { email: true } },
            },
          },
        },
      });

      const applied = await this.paymentsService.applyApprovedBankTransfer(
        {
          paymentId: notification.paymentId,
          notificationId: notification.id,
          notificationAmount: notification.amount,
          orderId: notification.orderId,
          orderTotal: notification.order.totalAmount,
          userId: notification.order.userId,
          currency: notification.order.currency,
          orderNumber: notification.order.orderNumber,
        },
        tx,
      );

      return {
        notification: updated,
        fullyPaid: applied.fullyPaid,
        alreadyApproved: false,
      };
    });

    if (!result.alreadyApproved) {
      await this.safeNotifyAfterApprove(result.notification, result.fullyPaid);
    }

    return this.getAdminById(id);
  }

  /** Side effects must not roll back an already-committed approval. */
  private async safeNotifyAfterApprove(
    approved: {
      id: string;
      orderId: string;
      amount: Prisma.Decimal;
      order: { orderNumber: string; userId: string; user: { email: string } };
    },
    fullyPaid: boolean,
  ): Promise<void> {
    try {
      await this.notificationsService?.enqueuePaymentEvent({
        userId: approved.order.userId,
        type: 'BANK_TRANSFER_APPROVED',
        title: fullyPaid ? 'Ödemeniz tamamlandı' : 'Kısmi ödemeniz onaylandı',
        body: fullyPaid
          ? `${approved.order.orderNumber} ödemesi onaylandı.`
          : `${approved.order.orderNumber} için ${toMoneyString(approved.amount)} TL onaylandı.`,
        data: { orderId: approved.orderId, transferId: approved.id },
      });
      if (fullyPaid) {
        await this.notificationsService?.enqueueOrderStatus(
          approved.orderId,
          approved.order.userId,
          OrderStatus.CONFIRMED,
          approved.order.orderNumber,
        );
        await this.emailOutbox.enqueue({
          event: 'OrderConfirmed',
          toEmail: approved.order.user.email,
          subject: `Siparişiniz onaylandı — ${approved.order.orderNumber}`,
          payload: {
            orderId: approved.orderId,
            orderNumber: approved.order.orderNumber,
          },
        });
      }
      await this.emailOutbox.enqueue({
        event: 'TransferApproved',
        toEmail: approved.order.user.email,
        subject: fullyPaid
          ? `Ödeme onaylandı — ${approved.order.orderNumber}`
          : `Kısmi ödeme onaylandı — ${approved.order.orderNumber}`,
        payload: {
          orderId: approved.orderId,
          orderNumber: approved.order.orderNumber,
          transferId: approved.id,
          amount: toMoneyString(approved.amount),
          fullyPaid,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Post-approve notify failed for transfer ${approved.id}: ${message}`,
      );
    }
  }

  async reject(
    id: string,
    adminUserId: string,
    reason: string,
    adminNote?: string,
  ): Promise<BankTransferResponseDto> {
    const rejected = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM bank_transfer_notifications WHERE id = ${id}::uuid FOR UPDATE
      `;
      const notification = await tx.bankTransferNotification.findUnique({
        where: { id },
        include: {
          order: {
            select: {
              orderNumber: true,
              userId: true,
              user: { select: { email: true } },
            },
          },
        },
      });
      if (!notification) {
        throw new NotFoundException('Bank transfer notification not found');
      }
      if (notification.status === BankTransferStatus.REJECTED) {
        return notification;
      }
      if (notification.status === BankTransferStatus.APPROVED) {
        throw new ConflictException('Bank transfer already approved');
      }

      const updated = await tx.bankTransferNotification.update({
        where: { id },
        data: {
          status: BankTransferStatus.REJECTED,
          rejectionReason: reason,
          adminNote: adminNote ?? reason,
          verifiedBy: adminUserId,
          verifiedAt: new Date(),
        },
        include: {
          order: {
            select: {
              orderNumber: true,
              userId: true,
              user: { select: { email: true } },
            },
          },
        },
      });

      await this.paymentsService.markRejectedKeepPending(
        notification.paymentId,
        reason,
        tx,
      );

      return updated;
    });

    try {
      await this.notificationsService?.enqueuePaymentEvent({
        userId: rejected.order.userId,
        type: 'BANK_TRANSFER_REJECTED',
        title: 'Ödeme bildiriminiz reddedildi',
        body: `${rejected.order.orderNumber}: ${reason}`,
        data: { orderId: rejected.orderId, transferId: rejected.id },
      });
      await this.emailOutbox.enqueue({
        event: 'TransferRejected',
        toEmail: rejected.order.user.email,
        subject: `Havale bildirimi reddedildi — ${rejected.order.orderNumber}`,
        payload: {
          orderId: rejected.orderId,
          orderNumber: rejected.order.orderNumber,
          transferId: rejected.id,
          reason,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Post-reject notify failed for transfer ${rejected.id}: ${message}`,
      );
    }

    return this.getAdminById(id);
  }

  private readonly detailInclude = {
    bankAccount: true,
    payment: { select: { id: true, status: true, paymentReference: true } },
    order: {
      select: {
        orderNumber: true,
        totalAmount: true,
        currency: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    },
  } as const;

  private async toResponseFull(
    notification: {
      id: string;
      orderId: string;
      paymentId: string;
      bankAccountId: string | null;
      amount: Prisma.Decimal;
      currency: string;
      amountMismatch: boolean;
      senderName: string;
      senderIban: string | null;
      transferDate: Date;
      referenceNumber: string | null;
      note: string | null;
      status: BankTransferStatus;
      rejectionReason: string | null;
      adminNote: string | null;
      verifiedAt: Date | null;
      createdAt: Date;
      bankAccount?: { bankName: string; iban?: string } | null;
      payment?: {
        id: string;
        status: PaymentStatus;
        paymentReference?: string | null;
      } | null;
      order: {
        orderNumber: string;
        totalAmount: Prisma.Decimal;
        user?: { firstName: string; lastName: string };
      };
    },
    includeTimeline = false,
  ): Promise<BankTransferResponseDto> {
    const approvedTotal = await this.paymentsService.sumApprovedTransfers(
      this.prisma,
      notification.orderId,
    );
    const remaining = this.paymentsService.remainingFrom(
      notification.order.totalAmount,
      approvedTotal,
    );
    const paymentStatus =
      notification.payment?.status ??
      (remaining.lte(0)
        ? PaymentStatus.PAID
        : approvedTotal.gt(0)
          ? PaymentStatus.PARTIALLY_PAID
          : PaymentStatus.PENDING);

    let timeline: BankTransferTimelineItemDto[] | undefined;
    if (includeTimeline) {
      const siblings = await this.prisma.bankTransferNotification.findMany({
        where: { orderId: notification.orderId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          verifiedAt: true,
          rejectionReason: true,
          referenceNumber: true,
        },
      });
      timeline = siblings.map((row) => ({
        id: row.id,
        amount: toMoneyString(row.amount),
        status: row.status,
        createdAt: row.createdAt,
        verifiedAt: row.verifiedAt,
        rejectionReason: row.rejectionReason,
        referenceNumber: row.referenceNumber,
      }));
    }

    return {
      id: notification.id,
      orderId: notification.orderId,
      paymentId: notification.paymentId,
      bankAccountId: notification.bankAccountId,
      amount: toMoneyString(notification.amount),
      currency: notification.currency,
      amountMismatch: notification.amountMismatch,
      orderTotal: toMoneyString(notification.order.totalAmount),
      approvedTotal: toMoneyString(approvedTotal),
      remainingAmount: toMoneyString(remaining),
      paymentStatus,
      senderName: notification.senderName,
      senderIban: notification.senderIban,
      transferDate: notification.transferDate,
      referenceNumber:
        notification.referenceNumber ??
        notification.payment?.paymentReference ??
        null,
      note: notification.note,
      status: notification.status,
      rejectionReason: notification.rejectionReason,
      adminNote: notification.adminNote,
      verifiedAt: notification.verifiedAt,
      createdAt: notification.createdAt,
      orderNumber: notification.order.orderNumber,
      customerName: notification.order.user
        ? `${notification.order.user.firstName} ${notification.order.user.lastName}`
        : undefined,
      bankName: notification.bankAccount?.bankName ?? null,
      bankIban: notification.bankAccount?.iban ?? null,
      timeline,
    };
  }
}
