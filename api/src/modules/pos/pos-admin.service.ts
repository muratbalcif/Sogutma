import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountTransactionType, AdminRoleCode, Prisma } from '@prisma/client';
import {
  PaginatedResponseDto,
  buildPaginatedResponse,
} from '../../common/dto/pagination.dto';
import { toMoneyString } from '../../common/utils/money.util';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { PosService } from './pos.service';
import {
  AdminPosCashierDto,
  AdminPosRegisterDto,
  AdminPosSaleDetailDto,
  AdminPosSaleListItemDto,
  AdminPosSaleListQueryDto,
  CreatePosRegisterDto,
  UpdatePosRegisterDto,
} from './dto/pos-admin.dto';

@Injectable()
export class PosAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posService: PosService,
    private readonly audit: AuditService,
  ) {}

  async listRegistersAdmin(): Promise<AdminPosRegisterDto[]> {
    const rows = await this.prisma.posRegister.findMany({
      orderBy: [{ code: 'asc' }],
    });
    return rows.map((r) => this.toAdminRegister(r));
  }

  /** Distinct cashiers who have POS sales (for list filters). */
  async listCashiers(): Promise<AdminPosCashierDto[]> {
    const rows = await this.prisma.posSale.findMany({
      distinct: ['userId'],
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.user.id,
      firstName: r.user.firstName,
      lastName: r.user.lastName,
      email: r.user.email,
      name: `${r.user.firstName} ${r.user.lastName}`.trim() || r.user.email,
    }));
  }

  async createRegister(
    dto: CreatePosRegisterDto,
    adminUserId: string,
  ): Promise<AdminPosRegisterDto> {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    if (!name || !code) {
      throw new BadRequestException('name and code are required');
    }
    try {
      const created = await this.prisma.posRegister.create({
        data: {
          name,
          code,
          isActive: dto.isActive ?? true,
        },
      });
      await this.audit.log({
        adminUserId,
        action: 'POS_REGISTER_CREATED',
        entityType: 'PosRegister',
        entityId: created.id,
        metadata: { code: created.code },
      });
      return this.toAdminRegister(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bu kasa kodu zaten kullanılıyor');
      }
      throw error;
    }
  }

  async updateRegister(
    id: string,
    dto: UpdatePosRegisterDto,
    adminUserId: string,
  ): Promise<AdminPosRegisterDto> {
    const existing = await this.prisma.posRegister.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Kasa bulunamadı');

    const data: Prisma.PosRegisterUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    try {
      const updated = await this.prisma.posRegister.update({
        where: { id },
        data,
      });
      await this.audit.log({
        adminUserId,
        action: 'POS_REGISTER_UPDATED',
        entityType: 'PosRegister',
        entityId: id,
        metadata: {
          code: updated.code,
          isActive: updated.isActive,
        },
      });
      return this.toAdminRegister(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bu kasa kodu zaten kullanılıyor');
      }
      throw error;
    }
  }

  async listSales(
    query: AdminPosSaleListQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<AdminPosSaleListItemDto>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const where = this.buildSaleWhere(query, actor);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.posSale.count({ where }),
      this.prisma.posSale.findMany({
        where,
        include: {
          register: { select: { id: true, code: true, name: true } },
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          payments: { select: { method: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return buildPaginatedResponse(
      rows.map((row) => ({
        id: row.id,
        saleNumber: row.saleNumber,
        createdAt: row.createdAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        registerId: row.registerId,
        registerCode: row.register.code,
        registerName: row.register.name,
        userId: row.userId,
        cashierName:
          `${row.user.firstName} ${row.user.lastName}`.trim() || row.user.email,
        customerId: row.customerId,
        customerName: row.customer
          ? `${row.customer.firstName} ${row.customer.lastName}`.trim() ||
            row.customer.email
          : null,
        grandTotal: toMoneyString(row.grandTotal),
        status: row.status,
        paymentMethods: [...new Set(row.payments.map((p) => p.method))],
      })),
      total,
      page,
      limit,
    );
  }

  async getSaleDetail(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<AdminPosSaleDetailDto> {
    const sale = await this.posService.getSaleById(id);
    if (this.shouldScopeToOwnSales(actor) && sale.userId !== actor.id) {
      throw new ForbiddenException('Bu POS satışına erişim yetkiniz yok');
    }

    const paymentIds = sale.payments.map((p) => p.id);
    const returns = await this.prisma.posReturn.findMany({
      where: { saleId: id },
      select: { id: true, payments: { select: { id: true } } },
    });
    const returnIds = returns.map((r) => r.id);
    const returnPaymentIds = returns.flatMap((r) =>
      r.payments.map((p) => p.id),
    );

    const ledgerRows = await this.prisma.accountTransaction.findMany({
      where: {
        OR: [
          { reference: `SALE:POS:${id}` },
          ...(paymentIds.length
            ? [
                {
                  reference: {
                    in: paymentIds.map((pid) => `PAYMENT:POS:${pid}`),
                  },
                },
              ]
            : []),
          ...(returnIds.length
            ? [
                {
                  reference: {
                    in: returnIds.map((rid) => `REVERSAL:POS_RETURN:${rid}`),
                  },
                },
              ]
            : []),
          ...(returnPaymentIds.length
            ? [
                {
                  reference: {
                    in: returnPaymentIds.map((pid) => `REFUND:POS:${pid}`),
                  },
                },
              ]
            : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      ...sale,
      ledger: ledgerRows.map((row) => {
        const amount = toMoneyString(row.amount);
        const isDebit =
          row.type === AccountTransactionType.SALE ||
          row.type === AccountTransactionType.REFUND ||
          row.type === AccountTransactionType.ADJUSTMENT;
        return {
          id: row.id,
          type: row.type,
          amount,
          debit: isDebit ? amount : null,
          credit: row.type === AccountTransactionType.PAYMENT ? amount : null,
          description: row.description,
          reference: row.reference,
          referenceType: row.referenceType,
          referenceId: row.referenceId,
          createdAt: row.createdAt.toISOString(),
        };
      }),
    };
  }

  /**
   * POS_CASHIER without register-manage permission may only see own sales.
   * SUPER_ADMIN and users with `pos.register` see all.
   */
  shouldScopeToOwnSales(user: AuthenticatedUser): boolean {
    if (user.roles.includes(AdminRoleCode.SUPER_ADMIN)) return false;
    if (user.permissions.includes('pos.register')) return false;
    return user.roles.includes(AdminRoleCode.POS_CASHIER);
  }

  private buildSaleWhere(
    query: AdminPosSaleListQueryDto,
    actor: AuthenticatedUser,
  ): Prisma.PosSaleWhereInput {
    const where: Prisma.PosSaleWhereInput = {};

    if (query.search?.trim()) {
      where.saleNumber = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = this.dayStart(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lt = this.dayEndExclusive(query.dateTo);
      }
    }

    if (query.registerId) where.registerId = query.registerId;

    if (this.shouldScopeToOwnSales(actor)) {
      where.userId = actor.id;
    } else if (query.userId) {
      where.userId = query.userId;
    }

    if (query.customerId === 'retail') {
      where.customerId = null;
    } else if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.status) where.status = query.status;

    if (query.paymentMethod) {
      where.payments = { some: { method: query.paymentMethod } };
    }

    return where;
  }

  /** YYYY-MM-DD → start of business day (Europe/Istanbul ≈ UTC+3). */
  private dayStart(date: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) throw new BadRequestException('Geçersiz tarih (YYYY-MM-DD)');
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const offsetMs = 3 * 60 * 60 * 1000;
    return new Date(Date.UTC(y, m - 1, d) - offsetMs);
  }

  private dayEndExclusive(date: string): Date {
    const start = this.dayStart(date);
    return new Date(start.getTime() + 24 * 60 * 60 * 1000);
  }

  private toAdminRegister(r: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    openedAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AdminPosRegisterDto {
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      isActive: r.isActive,
      openedAt: r.openedAt?.toISOString() ?? null,
      closedAt: r.closedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
