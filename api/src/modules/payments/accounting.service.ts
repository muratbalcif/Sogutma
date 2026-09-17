import { Injectable } from '@nestjs/common';
import { AccountTransactionType, Prisma } from '@prisma/client';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
  buildPaginatedResponse,
} from '../../common/dto/pagination.dto';
import { sumMoney, toMoneyString } from '../../common/utils/money.util';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Accounting convention:
 * - SALE = debit (customer owes us) — created when order is placed
 * - PAYMENT = credit (customer paid) — created when payment becomes PAID
 * - REFUND = debit (we owe customer / reverse credit) — created on refund
 * - balance = totalDebit - totalCredit (positive = customer owes)
 */
@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async recordIfAbsent(input: {
    userId: string;
    orderId?: string | null;
    paymentId?: string | null;
    type: AccountTransactionType;
    amount: Prisma.Decimal | string;
    currency: string;
    description: string;
    reference: string;
    tx?: Prisma.TransactionClient;
  }): Promise<{ created: boolean }> {
    const client = input.tx ?? this.prisma;
    const existing = await client.accountTransaction.findUnique({
      where: { reference: input.reference },
      select: { id: true },
    });
    if (existing) {
      return { created: false };
    }

    try {
      await client.accountTransaction.create({
        data: {
          userId: input.userId,
          orderId: input.orderId ?? null,
          paymentId: input.paymentId ?? null,
          type: input.type,
          amount: new Prisma.Decimal(input.amount),
          currency: input.currency,
          description: input.description,
          reference: input.reference,
        },
      });
      return { created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { created: false };
      }
      throw error;
    }
  }

  async getCurrentAccount(userId: string): Promise<{
    totalDebit: string;
    totalCredit: string;
    balance: string;
    currency: string;
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
      if (
        row.type === AccountTransactionType.SALE ||
        row.type === AccountTransactionType.REFUND ||
        row.type === AccountTransactionType.ADJUSTMENT
      ) {
        debit = debit.add(amount);
      } else if (row.type === AccountTransactionType.PAYMENT) {
        credit = credit.add(amount);
      }
    }

    const balance = debit.sub(credit);
    return {
      totalDebit: toMoneyString(debit),
      totalCredit: toMoneyString(credit),
      balance: toMoneyString(balance),
      currency: 'TRY',
    };
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
      createdAt: Date;
    }>
  > {
    const where = query.userId ? { userId: query.userId } : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.accountTransaction.count({ where }),
      this.prisma.accountTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return buildPaginatedResponse(
      items.map((item) => ({
        id: item.id,
        userId: item.userId,
        orderId: item.orderId,
        paymentId: item.paymentId,
        type: item.type,
        amount: toMoneyString(item.amount),
        currency: item.currency,
        description: item.description,
        reference: item.reference,
        createdAt: item.createdAt,
      })),
      total,
      query.page,
      query.limit,
    );
  }

  /** @deprecated helper kept for tests */
  sumAmounts(values: string[]): string {
    return toMoneyString(sumMoney(values));
  }
}
