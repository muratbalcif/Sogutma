import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BankTransferStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import {
  PaginatedResponseDto,
  buildPaginatedResponse,
} from '../../common/dto/pagination.dto';
import { toMoneyString } from '../../common/utils/money.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminBankTransferListQueryDto,
  BankTransferResponseDto,
  CreateBankTransferDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

/**
 * Bank transfer rejection sets Payment to FAILED.
 * Order remains PENDING. Customer may create a new payment attempt later.
 * Approval is idempotent: repeated approve on APPROVED returns current state.
 */
@Injectable()
export class BankTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async createNotification(
    userId: string,
    orderId: string,
    dto: CreateBankTransferDto,
  ): Promise<BankTransferResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
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

    const pending = await this.prisma.bankTransferNotification.findFirst({
      where: { orderId, status: BankTransferStatus.PENDING },
    });
    if (pending) {
      return this.toResponse(pending);
    }

    const created = await this.prisma.bankTransferNotification.create({
      data: {
        orderId,
        userId,
        paymentId: payment.id,
        amount: order.totalAmount,
        currency: order.currency,
        senderName: dto.senderName,
        senderIban: dto.senderIban?.toUpperCase(),
        transferDate: new Date(dto.transferDate),
        referenceNumber: dto.referenceNumber,
        note: dto.note,
        status: BankTransferStatus.PENDING,
      },
    });
    return this.toResponse(created);
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
    });
    if (!notification) {
      throw new NotFoundException('Bank transfer notification not found');
    }
    return this.toResponse(notification);
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
      }),
    ]);
    return buildPaginatedResponse(
      items.map((item) => this.toResponse(item)),
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
    const where: Prisma.BankTransferNotificationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
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
      this.prisma.bankTransferNotification.count({ where }),
      this.prisma.bankTransferNotification.findMany({
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

  async getAdminById(id: string): Promise<BankTransferResponseDto> {
    const notification = await this.prisma.bankTransferNotification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException('Bank transfer notification not found');
    }
    return this.toResponse(notification);
  }

  async approve(
    id: string,
    adminUserId: string,
  ): Promise<BankTransferResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM bank_transfer_notifications WHERE id = ${id}::uuid FOR UPDATE
      `;
      const notification = await tx.bankTransferNotification.findUnique({
        where: { id },
      });
      if (!notification) {
        throw new NotFoundException('Bank transfer notification not found');
      }
      if (notification.status === BankTransferStatus.APPROVED) {
        return;
      }
      if (notification.status === BankTransferStatus.REJECTED) {
        throw new ConflictException('Bank transfer already rejected');
      }

      await tx.bankTransferNotification.update({
        where: { id },
        data: {
          status: BankTransferStatus.APPROVED,
          verifiedBy: adminUserId,
          verifiedAt: new Date(),
        },
      });

      await this.paymentsService.markPaidFromBankTransfer(
        notification.paymentId,
        tx,
      );
    });

    return this.getAdminById(id);
  }

  async reject(
    id: string,
    adminUserId: string,
    reason: string,
  ): Promise<BankTransferResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM bank_transfer_notifications WHERE id = ${id}::uuid FOR UPDATE
      `;
      const notification = await tx.bankTransferNotification.findUnique({
        where: { id },
      });
      if (!notification) {
        throw new NotFoundException('Bank transfer notification not found');
      }
      if (notification.status === BankTransferStatus.REJECTED) {
        return;
      }
      if (notification.status === BankTransferStatus.APPROVED) {
        throw new ConflictException('Bank transfer already approved');
      }

      await tx.bankTransferNotification.update({
        where: { id },
        data: {
          status: BankTransferStatus.REJECTED,
          rejectionReason: reason,
          verifiedBy: adminUserId,
          verifiedAt: new Date(),
        },
      });

      await this.paymentsService.markFailedFromBankTransfer(
        notification.paymentId,
        reason,
        tx,
      );
    });

    return this.getAdminById(id);
  }

  private toResponse(notification: {
    id: string;
    orderId: string;
    paymentId: string;
    amount: Prisma.Decimal;
    currency: string;
    senderName: string;
    senderIban: string | null;
    transferDate: Date;
    referenceNumber: string | null;
    note: string | null;
    status: BankTransferStatus;
    rejectionReason: string | null;
    verifiedAt: Date | null;
    createdAt: Date;
  }): BankTransferResponseDto {
    return {
      id: notification.id,
      orderId: notification.orderId,
      paymentId: notification.paymentId,
      amount: toMoneyString(notification.amount),
      currency: notification.currency,
      senderName: notification.senderName,
      senderIban: notification.senderIban,
      transferDate: notification.transferDate,
      referenceNumber: notification.referenceNumber,
      note: notification.note,
      status: notification.status,
      rejectionReason: notification.rejectionReason,
      verifiedAt: notification.verifiedAt,
      createdAt: notification.createdAt,
    };
  }
}
