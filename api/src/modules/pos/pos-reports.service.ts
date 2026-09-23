import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PosPaymentMethod,
  PosPaymentStatus,
  PosSaleStatus,
  Prisma,
} from '@prisma/client';
import { toMoneyString } from '../../common/utils/money.util';
import { csvEscape } from '../../common/utils/security.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminPosReportQueryDto,
  AdminPosReportSummaryDto,
  AdminPosXReportQueryDto,
} from './dto/pos-phase5.dto';

@Injectable()
export class PosReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(
    query: AdminPosReportQueryDto,
  ): Promise<AdminPosReportSummaryDto> {
    const from = this.dayStart(query.from);
    const to = this.dayStart(query.to); // exclusive end date
    if (to <= from) {
      throw new BadRequestException('to must be after from (exclusive end)');
    }
    return this.buildSummary(from, to, query.registerId, query.cashierId, {
      from: query.from,
      to: query.to,
    });
  }

  /** X report: today’s open snapshot — no state mutation. */
  async xReport(
    query: AdminPosXReportQueryDto,
  ): Promise<AdminPosReportSummaryDto & { generatedAt: string }> {
    const { todayStart, todayEnd, dateKey } = this.todayBounds();
    const base = await this.buildSummary(
      todayStart,
      todayEnd,
      query.registerId,
      query.cashierId,
      { from: dateKey, to: this.nextDateKey(dateKey) },
    );
    return { ...base, generatedAt: new Date().toISOString() };
  }

  async exportCsv(query: AdminPosReportQueryDto): Promise<string> {
    const from = this.dayStart(query.from);
    const to = this.dayStart(query.to);
    if (to <= from) {
      throw new BadRequestException('to must be after from (exclusive end)');
    }

    const saleWhere: Prisma.PosSaleWhereInput = {
      createdAt: { gte: from, lt: to },
      status: { not: PosSaleStatus.CANCELLED },
    };
    if (query.registerId) saleWhere.registerId = query.registerId;
    if (query.cashierId) saleWhere.userId = query.cashierId;

    const sales = await this.prisma.posSale.findMany({
      where: saleWhere,
      include: {
        register: { select: { code: true, name: true } },
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
        customer: {
          select: { firstName: true, lastName: true, email: true },
        },
        payments: true,
        returns: { select: { totalAmount: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const header = [
      'date',
      'saleNumber',
      'register',
      'cashier',
      'customer',
      'paymentMethod',
      'grossAmount',
      'returnAmount',
      'netAmount',
      'status',
    ].join(',');

    const lines = sales.map((s) => {
      const returnAmount = s.returns.reduce(
        (acc, r) => acc.add(r.totalAmount),
        new Prisma.Decimal(0),
      );
      const gross = new Prisma.Decimal(s.grandTotal);
      const net = gross.sub(returnAmount);
      const methods = [...new Set(s.payments.map((p) => p.method))].join('|');
      const cashier =
        `${s.user.firstName} ${s.user.lastName}`.trim() || s.user.email;
      const customer = s.customer
        ? `${s.customer.firstName} ${s.customer.lastName}`.trim() ||
          s.customer.email
        : 'RETAIL';
      return [
        s.createdAt.toISOString(),
        s.saleNumber,
        s.register.code,
        cashier,
        customer,
        methods,
        toMoneyString(gross),
        toMoneyString(returnAmount),
        toMoneyString(net),
        s.status,
      ]
        .map((v) => csvEscape(String(v)))
        .join(',');
    });

    return [header, ...lines].join('\n');
  }

  private async buildSummary(
    from: Date,
    to: Date,
    registerId: string | undefined,
    cashierId: string | undefined,
    labels: { from: string; to: string },
  ): Promise<AdminPosReportSummaryDto> {
    const saleWhere: Prisma.PosSaleWhereInput = {
      createdAt: { gte: from, lt: to },
      status: { not: PosSaleStatus.CANCELLED },
    };
    if (registerId) saleWhere.registerId = registerId;
    if (cashierId) saleWhere.userId = cashierId;

    const returnWhere: Prisma.PosReturnWhereInput = {
      createdAt: { gte: from, lt: to },
      sale: {
        ...(registerId ? { registerId } : {}),
        ...(cashierId ? { userId: cashierId } : {}),
      },
    };

    const [
      saleAgg,
      itemAgg,
      returnAgg,
      payments,
      registerGroups,
      cashierGroups,
    ] = await Promise.all([
      this.prisma.posSale.aggregate({
        where: saleWhere,
        _count: { _all: true },
        _sum: { grandTotal: true },
      }),
      this.prisma.posSaleItem.aggregate({
        where: { sale: saleWhere },
        _sum: { quantity: true },
      }),
      this.prisma.posReturn.aggregate({
        where: returnWhere,
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.posPayment.groupBy({
        by: ['method'],
        where: {
          sale: saleWhere,
          status: { not: PosPaymentStatus.FAILED },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.posSale.groupBy({
        by: ['registerId'],
        where: saleWhere,
        _count: { _all: true },
        _sum: { grandTotal: true },
      }),
      this.prisma.posSale.groupBy({
        by: ['userId'],
        where: saleWhere,
        _count: { _all: true },
        _sum: { grandTotal: true },
      }),
    ]);

    const gross = new Prisma.Decimal(saleAgg._sum.grandTotal ?? 0);
    const returns = new Prisma.Decimal(returnAgg._sum.totalAmount ?? 0);
    const net = gross.sub(returns);
    const saleCount = saleAgg._count._all;
    const totalItems = itemAgg._sum.quantity ?? 0;
    const averageBasket =
      saleCount > 0
        ? toMoneyString(gross.div(saleCount).toDecimalPlaces(2))
        : '0.00';

    const methodOrder: PosPaymentMethod[] = [
      PosPaymentMethod.CASH,
      PosPaymentMethod.CARD,
      PosPaymentMethod.BANK_TRANSFER,
      PosPaymentMethod.ON_ACCOUNT,
    ];
    const payMap = new Map(
      payments.map((p) => [
        p.method,
        {
          count: p._count._all,
          amount: toMoneyString(p._sum.amount ?? 0),
        },
      ]),
    );
    const paymentBreakdown = methodOrder.map((method) => ({
      method,
      count: payMap.get(method)?.count ?? 0,
      amount: payMap.get(method)?.amount ?? '0.00',
    }));

    const registerIds = registerGroups.map((g) => g.registerId);
    const registers = registerIds.length
      ? await this.prisma.posRegister.findMany({
          where: { id: { in: registerIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const regMap = new Map(registers.map((r) => [r.id, r]));
    const registerBreakdown = registerGroups.map((g) => {
      const r = regMap.get(g.registerId);
      return {
        registerId: g.registerId,
        registerCode: r?.code ?? '',
        registerName: r?.name ?? '',
        saleCount: g._count._all,
        revenue: toMoneyString(g._sum.grandTotal ?? 0),
      };
    });

    const cashierIds = cashierGroups.map((g) => g.userId);
    const cashiers = cashierIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: cashierIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const cashMap = new Map(cashiers.map((c) => [c.id, c]));
    const cashierBreakdown = cashierGroups.map((g) => {
      const c = cashMap.get(g.userId);
      const name = c
        ? `${c.firstName} ${c.lastName}`.trim() || c.email
        : g.userId;
      return {
        cashierId: g.userId,
        cashierName: name,
        saleCount: g._count._all,
        revenue: toMoneyString(g._sum.grandTotal ?? 0),
      };
    });

    return {
      from: labels.from,
      to: labels.to,
      timezone: 'Europe/Istanbul',
      totalSales: saleCount,
      grossSales: toMoneyString(gross),
      returns: toMoneyString(returns),
      netSales: toMoneyString(net),
      totalItems,
      averageBasket,
      returnCount: returnAgg._count._all,
      paymentBreakdown,
      registerBreakdown,
      cashierBreakdown,
    };
  }

  private dayStart(date: string): Date {
    // Accept YYYY-MM-DD (preferred) or full ISO date-only prefix.
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
    if (!match) throw new BadRequestException('Geçersiz tarih (YYYY-MM-DD)');
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const offsetMs = 3 * 60 * 60 * 1000;
    return new Date(Date.UTC(y, m - 1, d) - offsetMs);
  }

  private todayBounds(): {
    todayStart: Date;
    todayEnd: Date;
    dateKey: string;
  } {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateKey = fmt.format(new Date());
    const todayStart = this.dayStart(dateKey);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    return { todayStart, todayEnd, dateKey };
  }

  private nextDateKey(dateKey: string): string {
    const start = this.dayStart(dateKey);
    const next = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fmt.format(next);
  }
}
