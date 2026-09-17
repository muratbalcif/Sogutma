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
  CreateBankTransferDto,
} from './dto/payment.dto';
import { EmailOutboxService } from './email-outbox.service';
import { PaymentsService } from './payments.service';

/**
 * Bank transfer rejection keeps Payment PENDING so the customer can resubmit.
 * Order is never auto-cancelled on reject.
 * Approval is idempotent: repeated approve on APPROVED returns current state.
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

    const payment = order.payments[0];
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

    if (dto.bankAccountId) {
      await this.bankAccountsService.requireActive(dto.bankAccountId);
    }

    const reportedAmount = dto.amount
      ? new Prisma.Decimal(dto.amount)
      : order.totalAmount;
    if (reportedAmount.lte(0)) {
      throw new BadRequestException('Transfer amount must be positive');
    }
    const amountMismatch = !reportedAmount.equals(order.totalAmount);

    const created = await this.prisma.bankTransferNotification.create({
      data: {
        orderId,
        userId,
        paymentId: payment.id,
        bankAccountId: dto.bankAccountId ?? null,
        amount: reportedAmount,
        currency: order.currency,
        amountMismatch,
        senderName: dto.senderName,
        senderIban: dto.senderIban?.toUpperCase(),
        transferDate: new Date(dto.transferDate),
        referenceNumber: dto.referenceNumber,
        note: dto.note,
        status: BankTransferStatus.PENDING,
      },
      include: {
        bankAccount: true,
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
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
      },
    });

    return this.toResponse(created, order.totalAmount);
  }

  async getForOrder(
    userId: string,
    orderId: string,
  ): Promise<BankTransferResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, totalAmount: true },
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
    return this.toResponse(notification, order.totalAmount);
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
    return this.toResponse(notification, notification.order.totalAmount);
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
    return buildPaginatedResponse(
      items.map((item) => this.toResponse(item, item.order.totalAmount)),
      total,
      page,
      limit,
    );
  }

  async listAdmin(
    query: AdminBankTransferListQueryDto,
  ): Promise<PaginatedResponseDto<BankTransferResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.BankTransferNotificationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
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

    return buildPaginatedResponse(
      items.map((item) => this.toResponse(item, item.order.totalAmount)),
      total,
      page,
      limit,
    );
  }

  async getAdminById(id: string): Promise<BankTransferResponseDto> {
    const notification = await this.prisma.bankTransferNotification.findUnique({
      where: { id },
      include: this.detailInclude,
    });
    if (!notification) {
      throw new NotFoundException('Bank transfer notification not found');
    }
    return this.toResponse(notification, notification.order.totalAmount);
  }

  async approve(
    id: string,
    adminUserId: string,
    adminNote?: string,
  ): Promise<BankTransferResponseDto> {
    const approved = await this.prisma.$transaction(async (tx) => {
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
      if (notification.status === BankTransferStatus.APPROVED) {
        return notification;
      }
      if (notification.status === BankTransferStatus.REJECTED) {
        throw new ConflictException('Bank transfer already rejected');
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
              orderNumber: true,
              userId: true,
              user: { select: { email: true } },
            },
          },
        },
      });

      await this.paymentsService.markPaidFromBankTransfer(
        notification.paymentId,
        tx,
      );

      return updated;
    });

    await this.safeNotifyAfterApprove(approved);

    return this.getAdminById(id);
  }

  /** Side effects must not roll back an already-committed approval. */
  private async safeNotifyAfterApprove(approved: {
    id: string;
    orderId: string;
    order: { orderNumber: string; userId: string; user: { email: string } };
  }): Promise<void> {
    try {
      await this.notificationsService?.enqueuePaymentEvent({
        userId: approved.order.userId,
        type: 'BANK_TRANSFER_APPROVED',
        title: 'Ödemeniz onaylandı',
        body: `${approved.order.orderNumber} ödemesi onaylandı.`,
        data: { orderId: approved.orderId, transferId: approved.id },
      });
      await this.notificationsService?.enqueueOrderStatus(
        approved.orderId,
        approved.order.userId,
        OrderStatus.CONFIRMED,
        approved.order.orderNumber,
      );
      await this.emailOutbox.enqueue({
        event: 'TransferApproved',
        toEmail: approved.order.user.email,
        subject: `Ödeme onaylandı — ${approved.order.orderNumber}`,
        payload: {
          orderId: approved.orderId,
          orderNumber: approved.order.orderNumber,
          transferId: approved.id,
        },
      });
      await this.emailOutbox.enqueue({
        event: 'OrderConfirmed',
        toEmail: approved.order.user.email,
        subject: `Siparişiniz onaylandı — ${approved.order.orderNumber}`,
        payload: {
          orderId: approved.orderId,
          orderNumber: approved.order.orderNumber,
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

      // Keep payment PENDING so customer can retry with payment instructions.
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
    order: {
      select: {
        orderNumber: true,
        totalAmount: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    },
  } as const;

  private toResponse(
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
      bankAccount?: { bankName: string } | null;
      order?: {
        orderNumber: string;
        totalAmount?: Prisma.Decimal;
        user?: { firstName: string; lastName: string };
      };
    },
    orderTotal: Prisma.Decimal,
  ): BankTransferResponseDto {
    return {
      id: notification.id,
      orderId: notification.orderId,
      paymentId: notification.paymentId,
      bankAccountId: notification.bankAccountId,
      amount: toMoneyString(notification.amount),
      currency: notification.currency,
      amountMismatch: notification.amountMismatch,
      orderTotal: toMoneyString(orderTotal),
      senderName: notification.senderName,
      senderIban: notification.senderIban,
      transferDate: notification.transferDate,
      referenceNumber: notification.referenceNumber,
      note: notification.note,
      status: notification.status,
      rejectionReason: notification.rejectionReason,
      adminNote: notification.adminNote,
      verifiedAt: notification.verifiedAt,
      createdAt: notification.createdAt,
      orderNumber: notification.order?.orderNumber,
      customerName: notification.order?.user
        ? `${notification.order.user.firstName} ${notification.order.user.lastName}`
        : undefined,
      bankName: notification.bankAccount?.bankName ?? null,
    };
  }
}
