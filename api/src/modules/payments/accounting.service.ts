import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountTransactionType,
  BankTransferStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
  buildPaginatedResponse,
} from '../../common/dto/pagination.dto';
import { sumMoney, toMoneyString } from '../../common/utils/money.util';
import { csvEscape } from '../../common/utils/security.util';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export type AccountReferenceType =
  | 'ORDER'
  | 'PAYMENT'
  | 'BANK_TRANSFER'
  | 'MANUAL'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'REVERSAL';

export type ManualDirection = 'DEBIT' | 'CREDIT';

/**
 * Accounting convention (source of truth: AccountTransaction ledger):
 * - SALE / REFUND / ADJUSTMENT = DEBIT (customer debt increases)
 * - PAYMENT = CREDIT (customer payment / alacak)
 * - balance = totalDebit - totalCredit (positive = customer owes us)
 *
 * Never hard-delete rows. Fix mistakes with ADJUSTMENT or REVERSAL references.
 */
@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  isDebitType(type: AccountTransactionType): boolean {
    return (
      type === AccountTransactionType.SALE ||
      type === AccountTransactionType.REFUND ||
      type === AccountTransactionType.ADJUSTMENT
    );
  }

  async recordIfAbsent(input: {
    userId: string;
    orderId?: string | null;
    paymentId?: string | null;
    type: AccountTransactionType;
    amount: Prisma.Decimal | string;
    currency: string;
    description: string;
    reference: string;
    referenceType?: AccountReferenceType | null;
    referenceId?: string | null;
    createdBy?: string | null;
    tx?: Prisma.TransactionClient;
  }): Promise<{ created: boolean; balanceAfter?: string }> {
    const run = async (client: Prisma.TransactionClient) => {
      const existing = await client.accountTransaction.findUnique({
        where: { reference: input.reference },
        select: { id: true, balanceAfter: true },
      });
      if (existing) {
        return {
          created: false,
          balanceAfter: existing.balanceAfter
            ? toMoneyString(existing.balanceAfter)
            : undefined,
        };
      }

      // Serialize per-customer ledger writes to keep balanceAfter correct.
      await client.$executeRaw`SELECT id FROM users WHERE id = CAST(${input.userId} AS uuid) FOR UPDATE`;

      const current = await this.computeBalanceWithClient(client, input.userId);
      const amount = new Prisma.Decimal(input.amount);
      const signed = this.isDebitType(input.type) ? amount : amount.neg();
      const balanceAfter = current.add(signed);

      try {
        await client.accountTransaction.create({
          data: {
            userId: input.userId,
            orderId: input.orderId ?? null,
            paymentId: input.paymentId ?? null,
            type: input.type,
            amount,
            currency: input.currency,
            description: input.description,
            reference: input.reference,
            referenceType: input.referenceType ?? null,
            referenceId: input.referenceId ?? null,
            balanceAfter,
            createdBy: input.createdBy ?? null,
          },
        });
        return { created: true, balanceAfter: toMoneyString(balanceAfter) };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return { created: false };
        }
        throw error;
      }
    };

    if (input.tx) {
      return run(input.tx);
    }
    return this.prisma.$transaction((tx) => run(tx));
  }

  private async computeBalanceWithClient(
    client: Prisma.TransactionClient | PrismaService,
    userId: string,
  ): Promise<Prisma.Decimal> {
    const rows = await client.accountTransaction.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amount: true },
    });
    let debit = new Prisma.Decimal(0);
    let credit = new Prisma.Decimal(0);
    for (const row of rows) {
      const amount = new Prisma.Decimal(row._sum.amount ?? 0);
      if (this.isDebitType(row.type)) {
        debit = debit.add(amount);
      } else if (row.type === AccountTransactionType.PAYMENT) {
        credit = credit.add(amount);
      }
    }
    return debit.sub(credit);
  }

  async getCurrentAccount(userId: string): Promise<{
    totalDebit: string;
    totalCredit: string;
    balance: string;
    currency: string;
    overdueAmount?: string;
    creditLimit?: string | null;
    allowCredit?: boolean;
    paymentTermDays?: number | null;
  }> {
    const rows = await this.prisma.accountTransaction.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amount: true },
    });

    let debit = new Prisma.Decimal(0);
    let credit = new Prisma.Decimal(0);
    for (const row of rows) {
      const amount = new Prisma.Decimal(row._sum.amount ?? 0);
      if (this.isDebitType(row.type)) {
        debit = debit.add(amount);
      } else if (row.type === AccountTransactionType.PAYMENT) {
        credit = credit.add(amount);
      }
    }
    const balance = debit.sub(credit);
    const corporate = await this.prisma.corporateCustomer.findUnique({
      where: { userId },
    });
    const overdueAmount = await this.computeOverdueAmount(userId);

    return {
      totalDebit: toMoneyString(debit),
      totalCredit: toMoneyString(credit),
      balance: toMoneyString(balance),
      currency: 'TRY',
      overdueAmount: toMoneyString(overdueAmount),
      creditLimit: corporate?.creditLimit
        ? toMoneyString(corporate.creditLimit)
        : null,
      allowCredit: corporate?.allowCredit ?? false,
      paymentTermDays: corporate?.paymentTermDays ?? null,
    };
  }

  async computeOverdueAmount(userId: string): Promise<Prisma.Decimal> {
    const now = new Date();
    const overdueOrders = await this.prisma.order.findMany({
      where: {
        userId,
        dueDate: { lt: now },
        status: { notIn: ['CANCELLED', 'RETURNED'] },
        payments: { none: { status: 'PAID' } },
      },
      select: { totalAmount: true },
    });
    return sumMoney(overdueOrders.map((o) => o.totalAmount));
  }

  /**
   * Credit-limit gate for cari (allowCredit) sales only.
   * Bank-transfer prepaid (allowCredit=false) skips this check.
   */
  async assertCreditLimitAllows(
    userId: string,
    newOrderAmount: Prisma.Decimal | string,
  ): Promise<void> {
    const corporate = await this.prisma.corporateCustomer.findUnique({
      where: { userId },
    });
    if (!corporate?.allowCredit) {
      return;
    }
    if (corporate.creditLimit == null) {
      return;
    }
    const account = await this.getCurrentAccount(userId);
    const projected = new Prisma.Decimal(account.balance).add(
      new Prisma.Decimal(newOrderAmount),
    );
    if (projected.greaterThan(corporate.creditLimit)) {
      throw new BadRequestException(
        `Credit limit exceeded: balance ${account.balance} + order ${toMoneyString(newOrderAmount)} > limit ${toMoneyString(corporate.creditLimit)}`,
      );
    }
  }

  async createManualTransaction(input: {
    customerId: string;
    direction: ManualDirection;
    amount: string;
    description: string;
    adminUserId: string;
    referenceNote?: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.customerId },
    });
    if (!user) {
      throw new NotFoundException('Customer not found');
    }
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be positive');
    }
    if (!input.description?.trim()) {
      throw new BadRequestException('Description is required');
    }

    const id = randomUUID();
    const isDebit = input.direction === 'DEBIT';
    const type = isDebit
      ? AccountTransactionType.ADJUSTMENT
      : AccountTransactionType.PAYMENT;
    const reference = isDebit ? `MANUAL:DEBIT:${id}` : `MANUAL:CREDIT:${id}`;

    const result = await this.recordIfAbsent({
      userId: input.customerId,
      type,
      amount,
      currency: 'TRY',
      description: input.description.trim(),
      reference,
      referenceType: 'MANUAL',
      referenceId: id,
      createdBy: input.adminUserId,
    });

    await this.audit.log({
      adminUserId: input.adminUserId,
      action: isDebit ? 'ACCOUNT_DEBIT' : 'ACCOUNT_CREDIT',
      entityType: 'AccountTransaction',
      entityId: reference,
      metadata: {
        customerId: input.customerId,
        direction: input.direction,
        amount: toMoneyString(amount),
        description: input.description,
        referenceNote: input.referenceNote ?? null,
        created: result.created,
      },
    });

    return {
      created: result.created,
      reference,
      balanceAfter: result.balanceAfter,
      type,
      amount: toMoneyString(amount),
      direction: input.direction,
    };
  }

  async createAdjustment(input: {
    customerId: string;
    direction: ManualDirection;
    amount: string;
    note: string;
    adminUserId: string;
  }) {
    if (!input.note?.trim()) {
      throw new BadRequestException('Admin note is required for adjustments');
    }
    const id = randomUUID();
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be positive');
    }
    const isDebit = input.direction === 'DEBIT';
    const type = isDebit
      ? AccountTransactionType.ADJUSTMENT
      : AccountTransactionType.PAYMENT;
    const reference = `ADJUSTMENT:${input.direction}:${id}`;

    const result = await this.recordIfAbsent({
      userId: input.customerId,
      type,
      amount,
      currency: 'TRY',
      description: `Adjustment: ${input.note.trim()}`,
      reference,
      referenceType: 'ADJUSTMENT',
      referenceId: id,
      createdBy: input.adminUserId,
    });

    await this.audit.log({
      adminUserId: input.adminUserId,
      action: 'ACCOUNT_ADJUSTMENT',
      entityType: 'AccountTransaction',
      entityId: reference,
      metadata: {
        customerId: input.customerId,
        direction: input.direction,
        amount: toMoneyString(amount),
        note: input.note,
        created: result.created,
      },
    });

    return result;
  }

  /** Reverse SALE debit when an unpaid order is cancelled (idempotent). */
  async reverseSaleForCancelledOrder(input: {
    tx: Prisma.TransactionClient;
    userId: string;
    orderId: string;
    orderNumber: string;
    actorUserId?: string | null;
  }): Promise<void> {
    const saleReference = `SALE:ORDER:${input.orderId}`;
    const sale = await input.tx.accountTransaction.findUnique({
      where: { reference: saleReference },
    });
    if (!sale) {
      return;
    }

    await this.recordIfAbsent({
      tx: input.tx,
      userId: input.userId,
      orderId: input.orderId,
      type: AccountTransactionType.PAYMENT,
      amount: sale.amount,
      currency: sale.currency,
      description: `Cancel reversal for order ${input.orderNumber}`,
      reference: `REVERSAL:${saleReference}`,
      referenceType: 'REVERSAL',
      referenceId: sale.id,
      createdBy: input.actorUserId ?? null,
    });
  }

  /** Reverse a prior ledger effect without mutating the original row. */
  async createReversal(input: {
    customerId: string;
    originalReference: string;
    adminUserId: string;
    note: string;
  }) {
    if (!input.note?.trim()) {
      throw new BadRequestException('Note is required for reversals');
    }
    const original = await this.prisma.accountTransaction.findUnique({
      where: { reference: input.originalReference },
    });
    if (!original || original.userId !== input.customerId) {
      throw new NotFoundException('Original transaction not found');
    }
    const reverseType = this.isDebitType(original.type)
      ? AccountTransactionType.PAYMENT
      : AccountTransactionType.ADJUSTMENT;
    const reference = `REVERSAL:${original.reference}`;

    const result = await this.recordIfAbsent({
      userId: input.customerId,
      orderId: original.orderId,
      paymentId: original.paymentId,
      type: reverseType,
      amount: original.amount,
      currency: original.currency,
      description: `Reversal of ${original.reference}: ${input.note.trim()}`,
      reference,
      referenceType: 'REVERSAL',
      referenceId: original.id,
      createdBy: input.adminUserId,
    });

    await this.audit.log({
      adminUserId: input.adminUserId,
      action: 'ACCOUNT_REVERSAL',
      entityType: 'AccountTransaction',
      entityId: reference,
      metadata: {
        originalReference: original.reference,
        amount: toMoneyString(original.amount),
        note: input.note,
        created: result.created,
      },
    });

    return result;
  }

  async listTransactions(
    query: PaginationQueryDto & { userId?: string },
  ): Promise<
    PaginatedResponseDto<{
      id: string;
      userId: string;
      orderId: string | null;
      paymentId: string | null;
      type: AccountTransactionType;
      amount: string;
      currency: string;
      description: string;
      reference: string;
      referenceType: string | null;
      referenceId: string | null;
      balanceAfter: string | null;
      createdAt: Date;
      debit: string | null;
      credit: string | null;
    }>
  > {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const where = query.userId ? { userId: query.userId } : {};
    const total = await this.prisma.accountTransaction.count({ where });
    const items = await this.prisma.accountTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return buildPaginatedResponse(
      items.map((item) => {
        const amount = toMoneyString(item.amount);
        const debit = this.isDebitType(item.type) ? amount : null;
        const credit =
          item.type === AccountTransactionType.PAYMENT ? amount : null;
        return {
          id: item.id,
          userId: item.userId,
          orderId: item.orderId,
          paymentId: item.paymentId,
          type: item.type,
          amount,
          currency: item.currency,
          description: item.description,
          reference: item.reference,
          referenceType: item.referenceType,
          referenceId: item.referenceId,
          balanceAfter: item.balanceAfter
            ? toMoneyString(item.balanceAfter)
            : null,
          createdAt: item.createdAt,
          debit,
          credit,
        };
      }),
      total,
      page,
      limit,
    );
  }

  async getStatement(userId: string, from?: string, to?: string) {
    const where: Prisma.AccountTransactionWhereInput = {
      userId,
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };
    const items = await this.prisma.accountTransaction.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    const summary = await this.getCurrentAccount(userId);
    return {
      summary,
      items: items.map((item) => {
        const amount = toMoneyString(item.amount);
        return {
          id: item.id,
          createdAt: item.createdAt,
          description: item.description,
          type: item.type,
          reference: item.reference,
          debit: this.isDebitType(item.type) ? amount : null,
          credit: item.type === AccountTransactionType.PAYMENT ? amount : null,
          balanceAfter: item.balanceAfter
            ? toMoneyString(item.balanceAfter)
            : null,
        };
      }),
    };
  }

  statementToCsv(
    statement: Awaited<ReturnType<typeof this.getStatement>>,
  ): string {
    const header = 'Tarih,Açıklama,Borç,Alacak,Bakiye';
    const rows = statement.items.map((row) =>
      [
        row.createdAt.toISOString(),
        csvEscape(row.description),
        row.debit ?? '',
        row.credit ?? '',
        row.balanceAfter ?? '',
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  async listCollections(query: {
    page?: number;
    limit?: number;
    customerId?: string;
    bankAccountId?: string;
    dateFrom?: string;
    dateTo?: string;
    minAmount?: string;
    maxAmount?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.BankTransferNotificationWhereInput = {
      status: BankTransferStatus.APPROVED,
      ...(query.customerId ? { userId: query.customerId } : {}),
      ...(query.bankAccountId ? { bankAccountId: query.bankAccountId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            verifiedAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.minAmount || query.maxAmount
        ? {
            amount: {
              ...(query.minAmount
                ? { gte: new Prisma.Decimal(query.minAmount) }
                : {}),
              ...(query.maxAmount
                ? { lte: new Prisma.Decimal(query.maxAmount) }
                : {}),
            },
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.bankTransferNotification.count({ where }),
      this.prisma.bankTransferNotification.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          order: { select: { id: true, orderNumber: true } },
          payment: { select: { id: true, status: true, amount: true } },
          bankAccount: { select: { id: true, bankName: true } },
        },
        orderBy: { verifiedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return buildPaginatedResponse(
      items.map((item) => ({
        id: item.id,
        customer: {
          id: item.user.id,
          name: `${item.user.firstName} ${item.user.lastName}`,
          email: item.user.email,
        },
        order: item.order,
        payment: item.payment,
        amount: toMoneyString(item.amount),
        currency: item.currency,
        bank: item.bankAccount?.bankName ?? null,
        transferDate: item.transferDate,
        approvedDate: item.verifiedAt,
        approvedBy: item.verifiedBy,
      })),
      total,
      page,
      limit,
    );
  }

  async collectionsSummary(timezone = 'Europe/Istanbul') {
    const bounds = businessDayBounds(timezone);
    const [todayAgg, monthAgg, pending, rejected] = await Promise.all([
      this.prisma.bankTransferNotification.aggregate({
        where: {
          status: BankTransferStatus.APPROVED,
          verifiedAt: { gte: bounds.todayStart, lt: bounds.todayEnd },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.bankTransferNotification.aggregate({
        where: {
          status: BankTransferStatus.APPROVED,
          verifiedAt: { gte: bounds.monthStart, lt: bounds.monthEnd },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.bankTransferNotification.count({
        where: { status: BankTransferStatus.PENDING },
      }),
      this.prisma.bankTransferNotification.count({
        where: { status: BankTransferStatus.REJECTED },
      }),
    ]);

    return {
      timezone,
      todayCollections: toMoneyString(todayAgg._sum.amount ?? 0),
      todayCount: todayAgg._count,
      monthCollections: toMoneyString(monthAgg._sum.amount ?? 0),
      monthCount: monthAgg._count,
      pendingTransfers: pending,
      rejectedTransfers: rejected,
    };
  }

  async financialReport(
    report:
      | 'sales'
      | 'collections'
      | 'current-account'
      | 'debtors'
      | 'overdue'
      | 'top-customers',
    query: { dateFrom?: string; dateTo?: string; limit?: number },
  ) {
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
    const createdAt =
      dateFrom || dateTo
        ? {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          }
        : undefined;

    switch (report) {
      case 'sales': {
        const orders = await this.prisma.order.groupBy({
          by: ['status'],
          where: createdAt ? { createdAt } : undefined,
          _sum: { totalAmount: true },
          _count: true,
        });
        return {
          report,
          rows: orders.map((o) => ({
            status: o.status,
            count: o._count,
            total: toMoneyString(o._sum.totalAmount ?? 0),
          })),
        };
      }
      case 'collections': {
        const rows = await this.prisma.bankTransferNotification.aggregate({
          where: {
            status: BankTransferStatus.APPROVED,
            ...(createdAt ? { verifiedAt: createdAt } : {}),
          },
          _sum: { amount: true },
          _count: true,
        });
        return {
          report,
          total: toMoneyString(rows._sum.amount ?? 0),
          count: rows._count,
        };
      }
      case 'current-account': {
        const txs = await this.prisma.accountTransaction.groupBy({
          by: ['type'],
          where: createdAt ? { createdAt } : undefined,
          _sum: { amount: true },
          _count: true,
        });
        return {
          report,
          rows: txs.map((t) => ({
            type: t.type,
            count: t._count,
            total: toMoneyString(t._sum.amount ?? 0),
          })),
        };
      }
      case 'debtors': {
        const balances = await this.balancesByCustomer();
        return {
          report,
          rows: balances
            .filter((b) => new Prisma.Decimal(b.balance).greaterThan(0))
            .sort((a, b) =>
              new Prisma.Decimal(b.balance).sub(a.balance).toNumber(),
            ),
        };
      }
      case 'overdue': {
        const now = new Date();
        const orders = await this.prisma.order.findMany({
          where: {
            dueDate: { lt: now },
            status: { notIn: ['CANCELLED', 'RETURNED'] },
            payments: { none: { status: 'PAID' } },
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { dueDate: 'asc' },
          take: query.limit ?? 100,
        });
        return {
          report,
          rows: orders.map((o) => ({
            orderId: o.id,
            orderNumber: o.orderNumber,
            customerId: o.userId,
            customerName: `${o.user.firstName} ${o.user.lastName}`,
            email: o.user.email,
            totalAmount: toMoneyString(o.totalAmount),
            dueDate: o.dueDate,
            balance: toMoneyString(o.totalAmount),
          })),
        };
      }
      case 'top-customers': {
        const rows = await this.prisma.order.groupBy({
          by: ['userId'],
          where: {
            status: { notIn: ['CANCELLED'] },
            ...(createdAt ? { createdAt } : {}),
          },
          _sum: { totalAmount: true },
          _count: true,
          orderBy: { _sum: { totalAmount: 'desc' } },
          take: query.limit ?? 20,
        });
        const users = await this.prisma.user.findMany({
          where: { id: { in: rows.map((r) => r.userId) } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        });
        const byId = new Map(users.map((u) => [u.id, u]));
        return {
          report,
          rows: rows.map((r) => {
            const u = byId.get(r.userId);
            return {
              customerId: r.userId,
              name: u ? `${u.firstName} ${u.lastName}` : r.userId,
              email: u?.email ?? null,
              orderCount: r._count,
              totalSales: toMoneyString(r._sum.totalAmount ?? 0),
            };
          }),
        };
      }
      default:
        throw new BadRequestException('Unknown report');
    }
  }

  async balancesByCustomer(): Promise<
    Array<{
      customerId: string;
      name: string;
      email: string;
      balance: string;
      totalDebit: string;
      totalCredit: string;
    }>
  > {
    const users = await this.prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const rows = await this.prisma.accountTransaction.groupBy({
      by: ['userId', 'type'],
      _sum: { amount: true },
    });
    const map = new Map<
      string,
      { debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();
    for (const row of rows) {
      const entry = map.get(row.userId) ?? {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };
      const amount = new Prisma.Decimal(row._sum.amount ?? 0);
      if (this.isDebitType(row.type)) {
        entry.debit = entry.debit.add(amount);
      } else if (row.type === AccountTransactionType.PAYMENT) {
        entry.credit = entry.credit.add(amount);
      }
      map.set(row.userId, entry);
    }
    return users
      .map((u) => {
        const entry = map.get(u.id) ?? {
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(0),
        };
        const balance = entry.debit.sub(entry.credit);
        return {
          customerId: u.id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          balance: toMoneyString(balance),
          totalDebit: toMoneyString(entry.debit),
          totalCredit: toMoneyString(entry.credit),
        };
      })
      .filter(
        (r) =>
          r.balance !== '0.00' ||
          r.totalDebit !== '0.00' ||
          r.totalCredit !== '0.00',
      );
  }

  reportToCsv(payload: { rows?: unknown[]; [key: string]: unknown }): string {
    const rows = (payload.rows ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      return 'result\n' + csvEscape(JSON.stringify(payload));
    }
    const keys = Object.keys(rows[0]);
    const header = keys.join(',');
    const lines = rows.map((row) =>
      keys
        .map((k) => {
          const value = row[k];
          if (value == null) return '';
          if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
          ) {
            return csvEscape(String(value));
          }
          return csvEscape(JSON.stringify(value));
        })
        .join(','),
    );
    return [header, ...lines].join('\n');
  }

  /** @deprecated helper kept for tests */
  sumAmounts(values: string[]): string {
    return toMoneyString(sumMoney(values));
  }
}

/** Business-day bounds in a named IANA timezone (default Europe/Istanbul). */
export function businessDayBounds(timezone: string): {
  todayStart: Date;
  todayEnd: Date;
  monthStart: Date;
  monthEnd: Date;
} {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);
  // Approximate: treat business local midnight as UTC±3 for Istanbul ops.
  // Precise DST handled via offset from a known Istanbul UTC+3 for v1.
  const offsetMs = timezone === 'Europe/Istanbul' ? 3 * 60 * 60 * 1000 : 0;
  const todayStart = new Date(Date.UTC(y, m - 1, d) - offsetMs);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(y, m - 1, 1) - offsetMs);
  const monthEnd = new Date(Date.UTC(y, m, 1) - offsetMs);
  return { todayStart, todayEnd, monthStart, monthEnd };
}
