import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminRoleCode,
  AccountTransactionType,
  PosPaymentMethod,
  PosPaymentStatus,
  PosSaleStatus,
  Prisma,
  UserType,
} from '@prisma/client';
import {
  extractInclusiveTax,
  multiplyMoney,
  sumMoney,
  toMoneyString,
} from '../../common/utils/money.util';
import { EnvironmentVariables } from '../../config/env.validation';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { InventoryService } from '../inventory/inventory.service';
import { AccountingService } from '../payments/accounting.service';
import { PriceService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePosSaleDto,
  PosProductLookupDto,
  PosRegisterDto,
  PosSaleResponseDto,
} from './dto/pos.dto';

const posSaleInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
  payments: { orderBy: { createdAt: 'asc' as const } },
  returns: {
    include: { items: true },
  },
  customer: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  user: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  register: true,
} satisfies Prisma.PosSaleInclude;

type PosSaleRow = Prisma.PosSaleGetPayload<{ include: typeof posSaleInclude }>;

/** Max cart+line discount share of gross before requiring elevated controls (still needs pos.discount). */
const MAX_DISCOUNT_RATIO = new Prisma.Decimal('0.5');

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly prices: PriceService,
    private readonly accounting: AccountingService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  private timezone(): string {
    return (
      this.config.get('BUSINESS_TIMEZONE', { infer: true }) ?? 'Europe/Istanbul'
    );
  }

  private hasPermission(user: AuthenticatedUser, code: string): boolean {
    if (user.roles.includes(AdminRoleCode.SUPER_ADMIN)) return true;
    return user.permissions.includes(code);
  }

  async listRegisters(): Promise<PosRegisterDto[]> {
    const rows = await this.prisma.posRegister.findMany({
      where: { isActive: true },
      orderBy: [{ code: 'asc' }],
    });
    return rows.map((r) => this.toRegister(r));
  }

  async lookupProduct(
    q: string,
    customerId?: string | null,
  ): Promise<PosProductLookupDto[]> {
    const query = q.trim();
    if (!query) {
      throw new BadRequestException('Arama metni gerekli');
    }

    let customerContext: { customerId?: string; userType?: UserType } = {};
    if (customerId) {
      const customer = await this.prisma.user.findUnique({
        where: { id: customerId },
        select: { id: true, userType: true, status: true },
      });
      if (customer?.status === 'ACTIVE') {
        customerContext = {
          customerId: customer.id,
          userType: customer.userType,
        };
      }
    }

    // Prefer exact barcode / SKU, then name contains.
    const products = await this.prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { barcode: query },
          { sku: { equals: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        vatRate: true,
        inventory: { select: { quantity: true, reservedQuantity: true } },
      },
      take: 25,
      orderBy: { name: 'asc' },
    });

    // Exact barcode first
    products.sort((a, b) => {
      const aExact =
        a.barcode === query || a.sku.toLowerCase() === query.toLowerCase()
          ? 0
          : 1;
      const bExact =
        b.barcode === query || b.sku.toLowerCase() === query.toLowerCase()
          ? 0
          : 1;
      return aExact - bExact;
    });

    const results: PosProductLookupDto[] = [];
    for (const p of products) {
      const resolved = await this.prices.resolvePrice(p.id, customerContext);
      const available = p.inventory
        ? p.inventory.quantity - p.inventory.reservedQuantity
        : 0;
      results.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        vatRate: toMoneyString(p.vatRate),
        unitPrice: resolved ? toMoneyString(resolved.amount) : null,
        availableStock: Math.max(0, available),
      });
    }
    return results;
  }

  async getSaleById(id: string): Promise<PosSaleResponseDto> {
    const sale = await this.prisma.posSale.findUnique({
      where: { id },
      include: posSaleInclude,
    });
    if (!sale) throw new NotFoundException('POS satış bulunamadı');
    return this.toResponse(
      sale,
      await this.optionalAccountSnapshot(sale.customerId),
    );
  }

  async getSaleByNumber(
    saleNumber: string,
  ): Promise<PosSaleResponseDto | null> {
    const normalized = saleNumber.trim().toUpperCase();
    if (!normalized) return null;
    const sale = await this.prisma.posSale.findUnique({
      where: { saleNumber: normalized },
      include: posSaleInclude,
    });
    if (!sale) return null;
    return this.toResponse(
      sale,
      await this.optionalAccountSnapshot(sale.customerId),
    );
  }

  /**
   * Single transactional POS checkout.
   * Phase 1: price/stock/payment validation + sale rows + inventory SALE.
   * Phase 2: accounting / cari (ON_ACCOUNT ledger + credit limit).
   */
  async createSale(
    dto: CreatePosSaleDto,
    actor: AuthenticatedUser,
    idempotencyKey?: string | null,
  ): Promise<PosSaleResponseDto> {
    if (!dto.items?.length) {
      throw new BadRequestException('En az bir ürün gerekli');
    }
    if (!dto.payments?.length) {
      throw new BadRequestException('En az bir ödeme gerekli');
    }

    const key = idempotencyKey?.trim() || null;
    if (key) {
      const existing = await this.prisma.posSale.findUnique({
        where: { idempotencyKey: key },
        include: posSaleInclude,
      });
      if (existing) {
        return this.toResponse(
          existing,
          await this.optionalAccountSnapshot(existing.customerId),
        );
      }
    }

    const register = await this.prisma.posRegister.findUnique({
      where: { id: dto.registerId },
    });
    if (!register || !register.isActive) {
      throw new BadRequestException('Kasa bulunamadı veya pasif');
    }

    const customerId = dto.customerId ?? null;
    let customerContext: { customerId?: string; userType?: UserType } = {};
    if (customerId) {
      const customer = await this.prisma.user.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          userType: true,
          status: true,
          corporateCustomer: { select: { allowCredit: true } },
        },
      });
      if (!customer || customer.status !== 'ACTIVE') {
        throw new NotFoundException('Müşteri bulunamadı');
      }
      customerContext = {
        customerId: customer.id,
        userType: customer.userType,
      };

      const wantsOnAccount = dto.payments.some(
        (p) => p.method === PosPaymentMethod.ON_ACCOUNT,
      );
      if (wantsOnAccount && !customer.corporateCustomer?.allowCredit) {
        throw new BadRequestException(
          'Bu müşteri için açık hesap (cari) satışına izin yok',
        );
      }
    } else {
      const wantsOnAccount = dto.payments.some(
        (p) => p.method === PosPaymentMethod.ON_ACCOUNT,
      );
      if (wantsOnAccount) {
        throw new BadRequestException('Açık hesap için müşteri seçimi zorunlu');
      }
    }

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        vatRate: true,
      },
    });
    const productById = new Map(products.map((p) => [p.id, p]));
    if (products.length !== productIds.length) {
      throw new BadRequestException('Bir veya daha fazla ürün geçersiz');
    }

    // Merge duplicate product lines (barcode re-scan semantics).
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
      barcode: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineSubtotal: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }> = [];

    let lineDiscountSum = new Prisma.Decimal(0);
    let grossBeforeCartDiscount = new Prisma.Decimal(0);

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
      // Backend is source of truth — ignore any client unitPrice.
      const unitPrice = new Prisma.Decimal(resolved.amount);
      const gross = multiplyMoney(unitPrice, quantity);
      const discountAmount = discount.greaterThan(gross) ? gross : discount;
      const lineTotal = gross.sub(discountAmount);
      const taxRate = new Prisma.Decimal(product.vatRate);
      const taxAmount = extractInclusiveTax(lineTotal, taxRate);
      const lineSubtotal = lineTotal.sub(taxAmount);

      lineDiscountSum = lineDiscountSum.add(discountAmount);
      grossBeforeCartDiscount = grossBeforeCartDiscount.add(lineTotal);

      linePlans.push({
        productId,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        quantity,
        unitPrice,
        discountAmount,
        taxRate,
        taxAmount,
        lineSubtotal,
        lineTotal,
      });
    }

    let cartDiscount = new Prisma.Decimal(0);
    if (dto.cartDiscountPercent != null && dto.cartDiscountPercent > 0) {
      cartDiscount = cartDiscount.add(
        grossBeforeCartDiscount
          .mul(dto.cartDiscountPercent)
          .div(100)
          .toDecimalPlaces(2),
      );
    }
    if (dto.cartDiscountAmount != null && dto.cartDiscountAmount > 0) {
      cartDiscount = cartDiscount.add(dto.cartDiscountAmount);
    }
    if (cartDiscount.greaterThan(grossBeforeCartDiscount)) {
      cartDiscount = grossBeforeCartDiscount;
    }

    const totalDiscount = lineDiscountSum.add(cartDiscount);
    if (totalDiscount.greaterThan(0)) {
      if (!this.hasPermission(actor, 'pos.discount')) {
        throw new ForbiddenException('İndirim yetkisi yok (pos.discount)');
      }
      const grossAll = sumMoney(
        linePlans.map((l) => multiplyMoney(l.unitPrice, l.quantity)),
      );
      if (
        grossAll.greaterThan(0) &&
        totalDiscount.div(grossAll).greaterThan(MAX_DISCOUNT_RATIO)
      ) {
        throw new BadRequestException(
          `İndirim toplamı brütün %${MAX_DISCOUNT_RATIO.mul(100).toFixed(0)} oranını aşamaz`,
        );
      }
    }

    // Allocate cart discount proportionally across lines for tax snapshot.
    const adjustedLines = this.allocateCartDiscount(linePlans, cartDiscount);
    const subtotal = sumMoney(adjustedLines.map((l) => l.lineSubtotal));
    const taxTotal = sumMoney(adjustedLines.map((l) => l.taxAmount));
    const linesGross = sumMoney(adjustedLines.map((l) => l.lineTotal));
    const grandTotal = linesGross; // cart discount already applied into lineTotals
    const discountTotal = totalDiscount;

    const paymentSum = sumMoney(
      dto.payments.map((p) => new Prisma.Decimal(p.amount)),
    );
    if (!paymentSum.equals(grandTotal)) {
      throw new BadRequestException(
        `Ödeme toplamı (${toMoneyString(paymentSum)}) satış tutarıyla (${toMoneyString(grandTotal)}) eşleşmiyor`,
      );
    }

    let sale: PosSaleRow;
    try {
      sale = await this.prisma.$transaction(async (tx) => {
        if (key) {
          const raced = await tx.posSale.findUnique({
            where: { idempotencyKey: key },
            include: posSaleInclude,
          });
          if (raced) return raced;
        }

        const saleNumber = await this.nextSaleNumber(tx);
        const created = await tx.posSale.create({
          data: {
            saleNumber,
            registerId: register.id,
            userId: actor.id,
            customerId,
            status: PosSaleStatus.COMPLETED,
            subtotal,
            discountTotal,
            taxTotal,
            grandTotal,
            note: dto.note,
            idempotencyKey: key,
            completedAt: new Date(),
            items: {
              create: adjustedLines.map((line) => ({
                productId: line.productId,
                productName: line.productName,
                sku: line.sku,
                barcode: line.barcode,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discountAmount: line.discountAmount,
                taxRate: line.taxRate,
                taxAmount: line.taxAmount,
                lineSubtotal: line.lineSubtotal,
                lineTotal: line.lineTotal,
              })),
            },
            payments: {
              create: dto.payments.map((p) => ({
                method: p.method,
                amount: new Prisma.Decimal(p.amount),
                status: PosPaymentStatus.COMPLETED,
                referenceNumber: p.referenceNumber,
              })),
            },
          },
          include: posSaleInclude,
        });

        for (const item of created.items) {
          if (!item.productId) continue;
          await this.inventory.sellAvailableInTransaction(
            tx,
            item.productId,
            item.quantity,
            {
              createdBy: actor.id,
              referenceType: 'POS_SALE',
              referenceId: item.id,
              note: `POS ${created.saleNumber}`,
            },
          );
        }

        // Cari ledger (AccountTransaction) — only when a customer is attached.
        // Walk-in retail (customerId null): no ledger rows (AccountTransaction.userId required).
        // Pattern mirrors orders: SALE:POS:{saleId} debit + PAYMENT:POS:{paymentId} credits.
        // Future refunds: REFUND:POS:* / REVERSAL (existing accounting.service helpers).
        if (customerId) {
          const onAccountTotal = sumMoney(
            created.payments
              .filter((p) => p.method === PosPaymentMethod.ON_ACCOUNT)
              .map((p) => p.amount),
          );

          if (onAccountTotal.greaterThan(0)) {
            await this.accounting.assertCreditLimitAllows(
              customerId,
              onAccountTotal,
              tx,
            );
          }

          await this.accounting.recordIfAbsent({
            tx,
            userId: customerId,
            type: AccountTransactionType.SALE,
            amount: created.grandTotal,
            currency: created.currency,
            description: `POS sale ${created.saleNumber}`,
            reference: `SALE:POS:${created.id}`,
            referenceType: 'POS_SALE',
            referenceId: created.id,
            createdBy: actor.id,
          });

          for (const payment of created.payments) {
            if (payment.method === PosPaymentMethod.ON_ACCOUNT) {
              // Open account: debt remains (DEBIT only). No CREDIT until a later payment.
              continue;
            }
            await this.accounting.recordIfAbsent({
              tx,
              userId: customerId,
              type: AccountTransactionType.PAYMENT,
              amount: payment.amount,
              currency: created.currency,
              description: `POS ${payment.method} ${created.saleNumber}`,
              reference: `PAYMENT:POS:${payment.id}`,
              referenceType: 'POS_PAYMENT',
              referenceId: payment.id,
              createdBy: actor.id,
            });
          }
        }

        return created;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        if (key) {
          const existing = await this.prisma.posSale.findUnique({
            where: { idempotencyKey: key },
            include: posSaleInclude,
          });
          if (existing) {
            return this.toResponse(
              existing,
              await this.optionalAccountSnapshot(existing.customerId),
            );
          }
        }
        throw new ConflictException('POS satış oluşturma çakışması');
      }
      throw error;
    }

    await this.audit.log({
      adminUserId: actor.id,
      action: 'POS_SALE_CREATED',
      entityType: 'PosSale',
      entityId: sale.id,
      metadata: {
        saleNumber: sale.saleNumber,
        grandTotal: toMoneyString(sale.grandTotal),
        retail: !sale.customerId,
        registerId: sale.registerId,
      },
    });

    return this.toResponse(
      sale,
      await this.optionalAccountSnapshot(sale.customerId),
    );
  }

  private async optionalAccountSnapshot(
    customerId: string | null,
  ): Promise<PosSaleResponseDto['account']> {
    if (!customerId) return null;
    const account = await this.accounting.getCurrentAccount(customerId);
    return {
      balance: account.balance,
      currency: account.currency,
      creditLimit: account.creditLimit ?? null,
      allowCredit: account.allowCredit ?? false,
    };
  }

  private allocateCartDiscount(
    lines: Array<{
      productId: string;
      productName: string;
      sku: string;
      barcode: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineSubtotal: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }>,
    cartDiscount: Prisma.Decimal,
  ) {
    if (cartDiscount.lessThanOrEqualTo(0)) {
      return lines;
    }
    const base = sumMoney(lines.map((l) => l.lineTotal));
    if (base.lessThanOrEqualTo(0)) return lines;

    let remaining = cartDiscount;
    return lines.map((line, index) => {
      const isLast = index === lines.length - 1;
      const share = isLast
        ? remaining
        : cartDiscount.mul(line.lineTotal).div(base).toDecimalPlaces(2);
      if (!isLast) remaining = remaining.sub(share);
      const lineTotal = line.lineTotal.sub(share);
      const discountAmount = line.discountAmount.add(share);
      const taxAmount = extractInclusiveTax(lineTotal, line.taxRate);
      const lineSubtotal = lineTotal.sub(taxAmount);
      return {
        ...line,
        discountAmount,
        taxAmount,
        lineSubtotal,
        lineTotal,
      };
    });
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

    await tx.posSaleNumberSequence.upsert({
      where: { dateKey },
      create: { dateKey, lastValue: 0 },
      update: {},
    });

    const updated = await tx.$queryRaw<Array<{ lastValue: number }>>`
      UPDATE pos_sale_number_sequences
      SET "lastValue" = "lastValue" + 1
      WHERE "dateKey" = ${dateKey}
      RETURNING "lastValue"
    `;

    const seq = updated[0]?.lastValue;
    if (!seq) {
      throw new ConflictException('POS satış numarası üretilemedi');
    }

    return `POS-${dateKey}-${String(seq).padStart(6, '0')}`;
  }

  private toRegister(r: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    openedAt: Date | null;
    closedAt: Date | null;
  }): PosRegisterDto {
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      isActive: r.isActive,
      openedAt: r.openedAt?.toISOString() ?? null,
      closedAt: r.closedAt?.toISOString() ?? null,
    };
  }

  private toResponse(
    sale: PosSaleRow,
    account: PosSaleResponseDto['account'] = null,
  ): PosSaleResponseDto {
    const returnedByItem = new Map<string, number>();
    for (const ret of sale.returns ?? []) {
      for (const ri of ret.items) {
        returnedByItem.set(
          ri.saleItemId,
          (returnedByItem.get(ri.saleItemId) ?? 0) + ri.quantity,
        );
      }
    }

    return {
      id: sale.id,
      saleNumber: sale.saleNumber,
      registerId: sale.registerId,
      userId: sale.userId,
      customerId: sale.customerId,
      status: sale.status,
      currency: sale.currency,
      subtotal: toMoneyString(sale.subtotal),
      discountTotal: toMoneyString(sale.discountTotal),
      taxTotal: toMoneyString(sale.taxTotal),
      grandTotal: toMoneyString(sale.grandTotal),
      note: sale.note,
      idempotencyKey: sale.idempotencyKey,
      completedAt: sale.completedAt?.toISOString() ?? null,
      createdAt: sale.createdAt.toISOString(),
      items: sale.items.map((item) => {
        const returnedQuantity = returnedByItem.get(item.id) ?? 0;
        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          barcode: item.barcode,
          quantity: item.quantity,
          returnedQuantity,
          returnableQuantity: Math.max(0, item.quantity - returnedQuantity),
          unitPrice: toMoneyString(item.unitPrice),
          discountAmount: toMoneyString(item.discountAmount),
          taxRate: toMoneyString(item.taxRate),
          taxAmount: toMoneyString(item.taxAmount),
          lineSubtotal: toMoneyString(item.lineSubtotal),
          lineTotal: toMoneyString(item.lineTotal),
        };
      }),
      payments: sale.payments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: toMoneyString(p.amount),
        status: p.status,
        referenceNumber: p.referenceNumber,
        createdAt: p.createdAt.toISOString(),
      })),
      customer: sale.customer
        ? {
            id: sale.customer.id,
            firstName: sale.customer.firstName,
            lastName: sale.customer.lastName,
            email: sale.customer.email,
          }
        : null,
      cashier: sale.user
        ? {
            id: sale.user.id,
            firstName: sale.user.firstName,
            lastName: sale.user.lastName,
            email: sale.user.email,
          }
        : null,
      register: sale.register ? this.toRegister(sale.register) : null,
      account,
    };
  }
}
