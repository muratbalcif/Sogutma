import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountTransactionType,
  AdminRoleCode,
  PosPaymentMethod,
  PosPaymentStatus,
  PosSaleStatus,
  Prisma,
} from '@prisma/client';
import { toMoneyString } from '../../common/utils/money.util';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { InventoryService } from '../inventory/inventory.service';
import { AccountingService } from '../payments/accounting.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePosReturnDto, PosReturnResponseDto } from './dto/pos-phase5.dto';

const returnInclude = {
  items: true,
  payments: true,
  sale: { select: { id: true, saleNumber: true, status: true } },
} as const;

@Injectable()
export class PosReturnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly accounting: AccountingService,
    private readonly audit: AuditService,
  ) {}

  async createReturn(
    saleId: string,
    dto: CreatePosReturnDto,
    actor: AuthenticatedUser,
    idempotencyKey?: string | null,
  ): Promise<PosReturnResponseDto> {
    if (!this.canRefund(actor)) {
      throw new ForbiddenException('pos.refund yetkisi gerekli');
    }

    const key = idempotencyKey?.trim() || null;
    if (key) {
      const existing = await this.prisma.posReturn.findUnique({
        where: { idempotencyKey: key },
        include: returnInclude,
      });
      if (existing) return this.toResponse(existing);
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT id FROM pos_sales WHERE id = CAST(${saleId} AS uuid) FOR UPDATE
        `;

        if (key) {
          const again = await tx.posReturn.findUnique({
            where: { idempotencyKey: key },
            include: returnInclude,
          });
          if (again) return again;
        }

        const sale = await tx.posSale.findUnique({
          where: { id: saleId },
          include: {
            items: true,
            payments: true,
            returns: { include: { items: true, payments: true } },
          },
        });
        if (!sale) throw new NotFoundException('POS satış bulunamadı');
        if (sale.status === PosSaleStatus.CANCELLED) {
          throw new BadRequestException('İptal edilmiş satış iade edilemez');
        }
        if (sale.status === PosSaleStatus.REFUNDED) {
          throw new BadRequestException('Satış zaten tamamen iade edilmiş');
        }

        const returnedByItem = new Map<string, number>();
        const refundedByMethod = new Map<PosPaymentMethod, Prisma.Decimal>();
        for (const ret of sale.returns) {
          for (const ri of ret.items) {
            returnedByItem.set(
              ri.saleItemId,
              (returnedByItem.get(ri.saleItemId) ?? 0) + ri.quantity,
            );
          }
          for (const rp of ret.payments) {
            const prev =
              refundedByMethod.get(rp.method) ?? new Prisma.Decimal(0);
            refundedByMethod.set(rp.method, prev.add(rp.amount));
          }
        }

        const mergedQty = new Map<string, number>();
        for (const line of dto.items) {
          if (line.quantity <= 0) {
            throw new BadRequestException('İade miktarı 0 veya negatif olamaz');
          }
          mergedQty.set(
            line.saleItemId,
            (mergedQty.get(line.saleItemId) ?? 0) + line.quantity,
          );
        }

        const itemById = new Map(sale.items.map((i) => [i.id, i]));
        const returnLines: Array<{
          saleItemId: string;
          productId: string | null;
          productName: string;
          sku: string;
          quantity: number;
          lineRefund: Prisma.Decimal;
        }> = [];

        for (const [saleItemId, qty] of mergedQty) {
          const item = itemById.get(saleItemId);
          if (!item) {
            throw new BadRequestException(
              `Satış kalemi bulunamadı: ${saleItemId}`,
            );
          }
          const already = returnedByItem.get(saleItemId) ?? 0;
          const remaining = item.quantity - already;
          if (qty > remaining) {
            throw new BadRequestException(
              `Aşırı iade: ${item.productName} (kalan ${remaining})`,
            );
          }

          const priorRefunds = sale.returns
            .flatMap((r) => r.items)
            .filter((ri) => ri.saleItemId === saleItemId)
            .reduce((acc, ri) => acc.add(ri.lineRefund), new Prisma.Decimal(0));

          let lineRefund: Prisma.Decimal;
          if (already + qty === item.quantity) {
            // Final slice: exact remainder so full return equals lineTotal.
            lineRefund = new Prisma.Decimal(item.lineTotal).sub(priorRefunds);
          } else {
            lineRefund = new Prisma.Decimal(item.lineTotal)
              .mul(qty)
              .div(item.quantity)
              .toDecimalPlaces(2);
          }
          if (lineRefund.lessThanOrEqualTo(0) && qty > 0) {
            throw new BadRequestException('İade tutarı hesaplanamadı');
          }

          returnLines.push({
            saleItemId: item.id,
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            quantity: qty,
            lineRefund,
          });
        }

        const totalAmount = returnLines.reduce(
          (acc, l) => acc.add(l.lineRefund),
          new Prisma.Decimal(0),
        );

        const paymentAlloc = this.allocateRefundPayments(
          sale.payments,
          refundedByMethod,
          totalAmount,
          dto.payments,
        );

        const createdReturn = await tx.posReturn.create({
          data: {
            saleId: sale.id,
            userId: actor.id,
            currency: sale.currency,
            totalAmount,
            reason: dto.reason?.trim() || null,
            note: dto.note?.trim() || null,
            idempotencyKey: key,
            items: {
              create: returnLines.map((l) => ({
                saleItemId: l.saleItemId,
                productId: l.productId,
                productName: l.productName,
                sku: l.sku,
                quantity: l.quantity,
                lineRefund: l.lineRefund,
              })),
            },
            payments: {
              create: paymentAlloc.map((p) => ({
                method: p.method,
                amount: p.amount,
              })),
            },
          },
          include: returnInclude,
        });

        for (const ri of createdReturn.items) {
          if (!ri.productId) continue;
          await this.inventory.commitReturnInTransaction(
            tx,
            ri.productId,
            ri.quantity,
            {
              createdBy: actor.id,
              referenceType: 'POS_SALE',
              referenceId: ri.id,
              note: `POS return ${sale.saleNumber}`,
            },
          );
        }

        if (sale.customerId) {
          await this.accounting.recordIfAbsent({
            tx,
            userId: sale.customerId,
            type: AccountTransactionType.PAYMENT,
            amount: totalAmount,
            currency: sale.currency,
            description: `POS return ${sale.saleNumber}`,
            reference: `REVERSAL:POS_RETURN:${createdReturn.id}`,
            referenceType: 'REVERSAL',
            referenceId: createdReturn.id,
            createdBy: actor.id,
          });

          for (const rp of createdReturn.payments) {
            if (rp.method === PosPaymentMethod.ON_ACCOUNT) continue;
            await this.accounting.recordIfAbsent({
              tx,
              userId: sale.customerId,
              type: AccountTransactionType.REFUND,
              amount: rp.amount,
              currency: sale.currency,
              description: `POS refund ${rp.method} ${sale.saleNumber}`,
              reference: `REFUND:POS:${rp.id}`,
              referenceType: 'REFUND',
              referenceId: rp.id,
              createdBy: actor.id,
            });
          }
        }

        // Mark original payments REFUNDED when fully refunded for that method.
        for (const op of sale.payments) {
          const prior =
            refundedByMethod.get(op.method) ?? new Prisma.Decimal(0);
          const thisRefund =
            paymentAlloc.find((p) => p.method === op.method)?.amount ??
            new Prisma.Decimal(0);
          const totalRefunded = prior.add(thisRefund);
          if (totalRefunded.greaterThanOrEqualTo(op.amount)) {
            await tx.posPayment.update({
              where: { id: op.id },
              data: { status: PosPaymentStatus.REFUNDED },
            });
          }
        }

        // Fully returned?
        const nextReturned = new Map(returnedByItem);
        for (const l of returnLines) {
          nextReturned.set(
            l.saleItemId,
            (nextReturned.get(l.saleItemId) ?? 0) + l.quantity,
          );
        }
        const fullyReturned = sale.items.every(
          (item) => (nextReturned.get(item.id) ?? 0) >= item.quantity,
        );
        if (fullyReturned) {
          await tx.posSale.update({
            where: { id: sale.id },
            data: { status: PosSaleStatus.REFUNDED },
          });
          createdReturn.sale.status = PosSaleStatus.REFUNDED;
        }

        return createdReturn;
      });

      await this.audit.log({
        adminUserId: actor.id,
        action: 'POS_RETURN_CREATED',
        entityType: 'PosReturn',
        entityId: created.id,
        metadata: {
          saleId,
          saleNumber: created.sale.saleNumber,
          totalAmount: toMoneyString(created.totalAmount),
        },
      });

      return this.toResponse(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        key
      ) {
        const existing = await this.prisma.posReturn.findUnique({
          where: { idempotencyKey: key },
          include: returnInclude,
        });
        if (existing) return this.toResponse(existing);
        throw new ConflictException('POS iade çakışması');
      }
      throw error;
    }
  }

  private canRefund(user: AuthenticatedUser): boolean {
    if (user.roles.includes(AdminRoleCode.SUPER_ADMIN)) return true;
    return user.permissions.includes('pos.refund');
  }

  /**
   * Allocate refund across original payment methods without exceeding remaining.
   * Prefer ON_ACCOUNT first (cari borç azaltma), then CASH → CARD → BANK_TRANSFER.
   */
  private allocateRefundPayments(
    originalPayments: Array<{
      method: PosPaymentMethod;
      amount: Prisma.Decimal;
    }>,
    alreadyRefunded: Map<PosPaymentMethod, Prisma.Decimal>,
    totalAmount: Prisma.Decimal,
    clientPayments?: Array<{ method: PosPaymentMethod; amount: number }>,
  ): Array<{ method: PosPaymentMethod; amount: Prisma.Decimal }> {
    const remainingByMethod = new Map<PosPaymentMethod, Prisma.Decimal>();
    for (const p of originalPayments) {
      const used = alreadyRefunded.get(p.method) ?? new Prisma.Decimal(0);
      const rem = new Prisma.Decimal(p.amount).sub(used);
      const clamped = rem.greaterThan(0) ? rem : new Prisma.Decimal(0);
      const prev = remainingByMethod.get(p.method) ?? new Prisma.Decimal(0);
      remainingByMethod.set(p.method, prev.add(clamped));
    }

    if (clientPayments?.length) {
      const alloc: Array<{ method: PosPaymentMethod; amount: Prisma.Decimal }> =
        [];
      let sum = new Prisma.Decimal(0);
      for (const p of clientPayments) {
        const amount = new Prisma.Decimal(p.amount).toDecimalPlaces(2);
        if (amount.lessThanOrEqualTo(0)) {
          throw new BadRequestException('İade ödeme tutarı geçersiz');
        }
        const rem = remainingByMethod.get(p.method) ?? new Prisma.Decimal(0);
        if (amount.greaterThan(rem)) {
          throw new BadRequestException(
            `İade tutarı ${p.method} kalanını aşıyor`,
          );
        }
        remainingByMethod.set(p.method, rem.sub(amount));
        alloc.push({ method: p.method, amount });
        sum = sum.add(amount);
      }
      if (!sum.equals(totalAmount)) {
        throw new BadRequestException(
          `İade ödeme toplamı (${toMoneyString(sum)}) ürün iade tutarına (${toMoneyString(totalAmount)}) eşit olmalı`,
        );
      }
      return alloc;
    }

    const order: PosPaymentMethod[] = [
      PosPaymentMethod.ON_ACCOUNT,
      PosPaymentMethod.CASH,
      PosPaymentMethod.CARD,
      PosPaymentMethod.BANK_TRANSFER,
    ];
    let left = totalAmount;
    const alloc: Array<{ method: PosPaymentMethod; amount: Prisma.Decimal }> =
      [];
    for (const method of order) {
      if (left.lessThanOrEqualTo(0)) break;
      const rem = remainingByMethod.get(method) ?? new Prisma.Decimal(0);
      if (rem.lessThanOrEqualTo(0)) continue;
      const take = (rem.lessThan(left) ? rem : left).toDecimalPlaces(2);
      if (take.lessThanOrEqualTo(0)) continue;
      alloc.push({ method, amount: take });
      left = left.sub(take);
    }
    if (left.greaterThan(0)) {
      throw new BadRequestException(
        'İade tutarı orijinal ödeme kalanını aşıyor',
      );
    }
    return alloc;
  }

  private toResponse(row: {
    id: string;
    saleId: string;
    userId: string;
    currency: string;
    totalAmount: Prisma.Decimal;
    reason: string | null;
    note: string | null;
    createdAt: Date;
    items: Array<{
      id: string;
      saleItemId: string;
      productId: string | null;
      productName: string;
      sku: string;
      quantity: number;
      lineRefund: Prisma.Decimal;
    }>;
    payments: Array<{
      id: string;
      method: PosPaymentMethod;
      amount: Prisma.Decimal;
    }>;
    sale: { saleNumber: string; status: PosSaleStatus };
  }): PosReturnResponseDto {
    return {
      id: row.id,
      saleId: row.saleId,
      saleNumber: row.sale.saleNumber,
      userId: row.userId,
      currency: row.currency,
      totalAmount: toMoneyString(row.totalAmount),
      reason: row.reason,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      saleStatus: row.sale.status,
      items: row.items.map((i) => ({
        id: i.id,
        saleItemId: i.saleItemId,
        productId: i.productId,
        productName: i.productName,
        sku: i.sku,
        quantity: i.quantity,
        lineRefund: toMoneyString(i.lineRefund),
      })),
      payments: row.payments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: toMoneyString(p.amount),
      })),
    };
  }
}
