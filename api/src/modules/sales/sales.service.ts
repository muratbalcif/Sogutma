import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  SalePaymentMethod,
  SaleStatus,
  UserType,
} from '@prisma/client';
import {
  PaginatedResponseDto,
  buildPaginatedResponse,
} from '../../common/dto/pagination.dto';
import {
  extractInclusiveTax,
  multiplyMoney,
  sumMoney,
  toMoneyString,
} from '../../common/utils/money.util';
import { EnvironmentVariables } from '../../config/env.validation';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { businessDayBounds } from '../payments/accounting.service';
import { PriceService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminSaleListQueryDto,
  CancelSaleDto,
  CreateSaleDto,
  DailySalesSummaryDto,
  SalePersonDto,
  SaleResponseDto,
} from './dto/sale.dto';

const saleInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
  customer: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} satisfies Prisma.SaleInclude;

type SaleRow = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly prices: PriceService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  private timezone(): string {
    return (
      this.config.get('BUSINESS_TIMEZONE', { infer: true }) ?? 'Europe/Istanbul'
    );
  }

  async create(
    dto: CreateSaleDto,
    adminUserId: string,
  ): Promise<SaleResponseDto> {
    if (!dto.items?.length) {
      throw new BadRequestException('En az bir ürün gerekli');
    }

    const customerId = dto.customerId ?? null;
    let customerContext: { customerId?: string; userType?: UserType } = {};
    if (customerId) {
      const customer = await this.prisma.user.findUnique({
        where: { id: customerId },
        select: { id: true, userType: true, status: true },
      });
      if (!customer || customer.status !== 'ACTIVE') {
        throw new NotFoundException('Müşteri bulunamadı');
      }
      customerContext = {
        customerId: customer.id,
        userType: customer.userType,
      };
    }

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
      select: { id: true, name: true, sku: true, vatRate: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));
    if (products.length !== productIds.length) {
      throw new BadRequestException('Bir veya daha fazla ürün geçersiz');
    }

    // Merge duplicate product lines
    const qtyByProduct = new Map<
      string,
      { quantity: number; discount: Prisma.Decimal }
    >();
    for (const item of dto.items) {
      const prev = qtyByProduct.get(item.productId) ?? {
        quantity: 0,
        discount: new Prisma.Decimal(0),
      };
      qtyByProduct.set(item.productId, {
        quantity: prev.quantity + item.quantity,
        discount: prev.discount.add(item.discountAmount ?? 0),
      });
    }

    const linePlans: Array<{
      productId: string;
      productName: string;
      sku: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineSubtotal: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }> = [];

    for (const [productId, { quantity, discount }] of qtyByProduct) {
      const product = productById.get(productId)!;
      const resolved = await this.prices.resolvePrice(
        productId,
        customerContext,
      );
      if (!resolved) {
        throw new BadRequestException(
          `Ürün için fiyat bulunamadı: ${product.sku}`,
        );
      }
      const unitPrice = new Prisma.Decimal(resolved.amount);
      const gross = multiplyMoney(unitPrice, quantity);
      const discountAmount = discount.greaterThan(gross) ? gross : discount;
      const lineTotal = gross.sub(discountAmount);
      const taxRate = new Prisma.Decimal(product.vatRate);
      const taxAmount = extractInclusiveTax(lineTotal, taxRate);
      const lineSubtotal = lineTotal.sub(taxAmount);

      linePlans.push({
        productId,
        productName: product.name,
        sku: product.sku,
        quantity,
        unitPrice,
        discountAmount,
        taxRate,
        taxAmount,
        lineSubtotal,
        lineTotal,
      });
    }

    const subtotal = sumMoney(linePlans.map((l) => l.lineSubtotal));
    const discountAmount = sumMoney(linePlans.map((l) => l.discountAmount));
    const taxAmount = sumMoney(linePlans.map((l) => l.taxAmount));
    const totalAmount = sumMoney(linePlans.map((l) => l.lineTotal));

    const sale = await this.prisma.$transaction(async (tx) => {
      const saleNumber = await this.nextSaleNumber(tx);
      const created = await tx.sale.create({
        data: {
          saleNumber,
          customerId,
          createdById: adminUserId,
          status: SaleStatus.COMPLETED,
          paymentMethod: dto.paymentMethod,
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          note: dto.note,
          items: {
            create: linePlans.map((line) => ({
              productId: line.productId,
              productName: line.productName,
              sku: line.sku,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountAmount: line.discountAmount,
              taxRate: line.taxRate,
              taxAmount: line.taxAmount,
              lineSubtotal: line.lineSubtotal,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: saleInclude,
      });

      for (const item of created.items) {
        if (!item.productId) continue;
        await this.inventory.sellAvailableInTransaction(
          tx,
          item.productId,
          item.quantity,
          {
            createdBy: adminUserId,
            referenceType: 'SALE',
            referenceId: item.id,
            note: `POS ${created.saleNumber}`,
          },
        );
      }

      return created;
    });

    await this.audit.log({
      adminUserId,
      action: 'SALE_CREATED',
      entityType: 'Sale',
      entityId: sale.id,
      metadata: {
        saleNumber: sale.saleNumber,
        totalAmount: toMoneyString(sale.totalAmount),
        retail: !sale.customerId,
      },
    });

    return this.toResponse(sale);
  }

  async list(
    query: AdminSaleListQueryDto,
  ): Promise<PaginatedResponseDto<SaleResponseDto>> {
    const where = this.buildWhere(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        include: saleInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return buildPaginatedResponse(
      rows.map((row) => this.toResponse(row)),
      total,
      page,
      limit,
    );
  }

  async getById(id: string): Promise<SaleResponseDto> {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: saleInclude,
    });
    if (!sale) throw new NotFoundException('Satış bulunamadı');
    return this.toResponse(sale);
  }

  async dailySummary(date: string): Promise<DailySalesSummaryDto> {
    const { start, end } = this.dayBoundsForDate(date);
    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        status: SaleStatus.COMPLETED,
      },
      include: { items: true },
    });

    const cancelled = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        status: SaleStatus.CANCELLED,
      },
      select: { totalAmount: true },
    });

    let cash = new Prisma.Decimal(0);
    let card = new Prisma.Decimal(0);
    let bank = new Prisma.Decimal(0);
    let itemCount = 0;
    let retailSaleCount = 0;
    let customerSaleCount = 0;
    const totals: Prisma.Decimal[] = [];

    for (const sale of sales) {
      totals.push(sale.totalAmount);
      itemCount += sale.items.reduce((s, i) => s + i.quantity, 0);
      if (sale.customerId) customerSaleCount += 1;
      else retailSaleCount += 1;
      if (sale.paymentMethod === SalePaymentMethod.CASH) {
        cash = cash.add(sale.totalAmount);
      } else if (sale.paymentMethod === SalePaymentMethod.CREDIT_CARD) {
        card = card.add(sale.totalAmount);
      } else {
        bank = bank.add(sale.totalAmount);
      }
    }

    return {
      date,
      totalSales: toMoneyString(sumMoney(totals)),
      saleCount: sales.length,
      itemCount,
      refundTotal: toMoneyString(sumMoney(cancelled.map((c) => c.totalAmount))),
      retailSaleCount,
      customerSaleCount,
      paymentBreakdown: {
        cash: toMoneyString(cash),
        card: toMoneyString(card),
        bankTransfer: toMoneyString(bank),
      },
    };
  }

  async cancel(
    id: string,
    adminUserId: string,
    dto: CancelSaleDto,
  ): Promise<SaleResponseDto> {
    const existing = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throw new NotFoundException('Satış bulunamadı');
    if (existing.status === SaleStatus.CANCELLED) {
      throw new ConflictException('Satış zaten iptal edilmiş');
    }

    const sale = await this.prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        if (!item.productId) continue;
        await this.inventory.commitReturnInTransaction(
          tx,
          item.productId,
          item.quantity,
          {
            createdBy: adminUserId,
            referenceType: 'SALE',
            referenceId: item.id,
            note: `POS cancel ${existing.saleNumber}`,
          },
        );
      }

      return tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledById: adminUserId,
          cancelReason: dto.reason,
        },
        include: saleInclude,
      });
    });

    await this.audit.log({
      adminUserId,
      action: 'SALE_CANCELLED',
      entityType: 'Sale',
      entityId: id,
      metadata: { saleNumber: existing.saleNumber },
    });

    return this.toResponse(sale);
  }

  private buildWhere(query: AdminSaleListQueryDto): Prisma.SaleWhereInput {
    const where: Prisma.SaleWhereInput = {};

    if (query.date) {
      const { start, end } = this.dayBoundsForDate(query.date);
      where.createdAt = { gte: start, lt: end };
    } else if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = this.dayBoundsForDate(query.dateFrom).start;
      }
      if (query.dateTo) {
        where.createdAt.lt = this.dayBoundsForDate(query.dateTo).end;
      }
    }

    if (query.retailOnly || query.customerId === 'retail') {
      where.customerId = null;
    } else if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.createdById) where.createdById = query.createdById;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
    if (query.status) where.status = query.status;

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { saleNumber: { contains: q, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        { items: { some: { sku: { contains: q, mode: 'insensitive' } } } },
        {
          items: {
            some: { productName: { contains: q, mode: 'insensitive' } },
          },
        },
      ];
    }

    return where;
  }

  /** Parse YYYY-MM-DD into business-timezone day bounds. */
  private dayBoundsForDate(date: string): { start: Date; end: Date } {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) {
      throw new BadRequestException('Geçersiz tarih (YYYY-MM-DD)');
    }
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const tz = this.timezone();
    const offsetMs = tz === 'Europe/Istanbul' ? 3 * 60 * 60 * 1000 : 0;
    const start = new Date(Date.UTC(y, m - 1, d) - offsetMs);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }

  /** Today bounds helper for list default (unused export for tests). */
  todayBounds() {
    return businessDayBounds(this.timezone());
  }

  private async nextSaleNumber(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(now);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    const dateKey = `${y}${m}${d}`;

    await tx.saleNumberSequence.upsert({
      where: { dateKey },
      create: { dateKey, lastValue: 0 },
      update: {},
    });

    const updated = await tx.$queryRaw<Array<{ lastValue: number }>>`
      UPDATE sale_number_sequences
      SET "lastValue" = "lastValue" + 1
      WHERE "dateKey" = ${dateKey}
      RETURNING "lastValue"
    `;

    const seq = updated[0]?.lastValue;
    if (!seq) {
      throw new ConflictException('Satış numarası üretilemedi');
    }

    return `PS-${dateKey}-${String(seq).padStart(5, '0')}`;
  }

  private toPerson(
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null,
  ): SalePersonDto | null {
    if (!user) return null;
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };
  }

  private toResponse(sale: SaleRow): SaleResponseDto {
    const customer = this.toPerson(sale.customer);
    return {
      id: sale.id,
      saleNumber: sale.saleNumber,
      customerId: sale.customerId,
      customerLabel: customer
        ? `${customer.firstName} ${customer.lastName}`.trim() || customer.email
        : 'Perakende Satış',
      customer,
      createdBy: this.toPerson(sale.createdBy)!,
      status: sale.status,
      paymentMethod: sale.paymentMethod,
      currency: sale.currency,
      subtotal: toMoneyString(sale.subtotal),
      discountAmount: toMoneyString(sale.discountAmount),
      taxAmount: toMoneyString(sale.taxAmount),
      totalAmount: toMoneyString(sale.totalAmount),
      note: sale.note,
      cancelledAt: sale.cancelledAt?.toISOString() ?? null,
      cancelReason: sale.cancelReason,
      createdAt: sale.createdAt.toISOString(),
      items: sale.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: toMoneyString(item.unitPrice),
        discountAmount: toMoneyString(item.discountAmount),
        taxRate: toMoneyString(item.taxRate),
        taxAmount: toMoneyString(item.taxAmount),
        lineSubtotal: toMoneyString(item.lineSubtotal),
        lineTotal: toMoneyString(item.lineTotal),
      })),
      itemCount: sale.items.reduce((s, i) => s + i.quantity, 0),
    };
  }
}
