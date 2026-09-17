import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Coupon, CouponType, Prisma } from '@prisma/client';
import { toMoneyString } from '../../common/utils/money.util';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CouponResponseDto,
  CouponValidationResultDto,
  CreateCouponDto,
  UpdateCouponDto,
} from './dto/coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  async listAdmin(): Promise<CouponResponseDto[]> {
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { usages: true } } },
    });
    return coupons.map((c) => this.toResponse(c, c._count.usages));
  }

  async getAdminById(id: string): Promise<CouponResponseDto> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { usages: true } } },
    });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return this.toResponse(coupon, coupon._count.usages);
  }

  async create(
    dto: CreateCouponDto,
    adminUserId?: string,
  ): Promise<CouponResponseDto> {
    this.assertCouponRules(dto.type, dto.value, dto.startsAt, dto.endsAt);
    const code = this.normalizeCode(dto.code);
    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('Coupon code already exists');
    }
    const created = await this.prisma.coupon.create({
      data: {
        code,
        description: dto.description,
        type: dto.type,
        value: new Prisma.Decimal(dto.value),
        minimumOrderAmount: dto.minimumOrderAmount
          ? new Prisma.Decimal(dto.minimumOrderAmount)
          : null,
        maximumDiscountAmount: dto.maximumDiscountAmount
          ? new Prisma.Decimal(dto.maximumDiscountAmount)
          : null,
        usageLimit: dto.usageLimit ?? null,
        perUserLimit: dto.perUserLimit ?? null,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        active: dto.active ?? true,
      },
    });
    if (adminUserId) {
      await this.audit.log({
        adminUserId,
        action: 'COUPON_CREATED',
        entityType: 'Coupon',
        entityId: created.id,
        metadata: { code },
      });
    }
    return this.toResponse(created, 0);
  }

  async update(
    id: string,
    dto: UpdateCouponDto,
    adminUserId?: string,
  ): Promise<CouponResponseDto> {
    const existing = await this.prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { usages: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }
    const type = dto.type ?? existing.type;
    const value = dto.value ?? toMoneyString(existing.value);
    const startsAt = dto.startsAt ?? existing.startsAt.toISOString();
    const endsAt = dto.endsAt ?? existing.endsAt.toISOString();
    this.assertCouponRules(type, value, startsAt, endsAt);

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: {
        description:
          dto.description === undefined ? undefined : dto.description,
        type: dto.type,
        value:
          dto.value === undefined ? undefined : new Prisma.Decimal(dto.value),
        minimumOrderAmount:
          dto.minimumOrderAmount === undefined
            ? undefined
            : dto.minimumOrderAmount
              ? new Prisma.Decimal(dto.minimumOrderAmount)
              : null,
        maximumDiscountAmount:
          dto.maximumDiscountAmount === undefined
            ? undefined
            : dto.maximumDiscountAmount
              ? new Prisma.Decimal(dto.maximumDiscountAmount)
              : null,
        usageLimit: dto.usageLimit === undefined ? undefined : dto.usageLimit,
        perUserLimit:
          dto.perUserLimit === undefined ? undefined : dto.perUserLimit,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        active: dto.active,
      },
      include: { _count: { select: { usages: true } } },
    });

    if (adminUserId) {
      const action =
        dto.active === undefined
          ? 'COUPON_UPDATED'
          : dto.active
            ? 'COUPON_ACTIVATED'
            : 'COUPON_DEACTIVATED';
      await this.audit.log({
        adminUserId,
        action,
        entityType: 'Coupon',
        entityId: id,
        metadata: { code: updated.code },
      });
    }

    return this.toResponse(updated, updated._count.usages);
  }

  /**
   * Authoritative coupon discount calculation. Client must never send
   * discountAmount — only the code.
   */
  async validateForUser(input: {
    code: string;
    userId: string;
    orderAmount: Prisma.Decimal;
  }): Promise<CouponValidationResultDto> {
    const code = this.normalizeCode(input.code);
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon) {
      return { valid: false, code, message: 'Invalid coupon code' };
    }
    const now = new Date();
    if (!coupon.active) {
      return { valid: false, code, message: 'Coupon is inactive' };
    }
    if (coupon.startsAt > now) {
      return { valid: false, code, message: 'Coupon has not started yet' };
    }
    if (coupon.endsAt < now) {
      return { valid: false, code, message: 'Coupon has expired' };
    }
    if (
      coupon.minimumOrderAmount &&
      input.orderAmount.lessThan(coupon.minimumOrderAmount)
    ) {
      return {
        valid: false,
        code,
        message: `Minimum order amount is ${toMoneyString(coupon.minimumOrderAmount)}`,
      };
    }

    const totalUsages = await this.prisma.couponUsage.count({
      where: { couponId: coupon.id },
    });
    if (coupon.usageLimit !== null && totalUsages >= coupon.usageLimit) {
      return { valid: false, code, message: 'Coupon usage limit reached' };
    }

    const userUsages = await this.prisma.couponUsage.count({
      where: { couponId: coupon.id, userId: input.userId },
    });
    if (coupon.perUserLimit !== null && userUsages >= coupon.perUserLimit) {
      return {
        valid: false,
        code,
        message: 'You have already used this coupon the maximum times',
      };
    }

    const discount = this.calculateDiscount(coupon, input.orderAmount);
    if (discount.lessThanOrEqualTo(0)) {
      return { valid: false, code, message: 'Coupon produces no discount' };
    }

    return {
      valid: true,
      code,
      couponId: coupon.id,
      discountAmount: toMoneyString(discount),
      type: coupon.type,
      value: toMoneyString(coupon.value),
      message: 'Coupon applied',
    };
  }

  calculateDiscount(
    coupon: Coupon,
    orderAmount: Prisma.Decimal,
  ): Prisma.Decimal {
    let discount =
      coupon.type === CouponType.PERCENTAGE
        ? orderAmount.mul(coupon.value).div(100)
        : coupon.value;

    if (discount.greaterThan(orderAmount)) {
      discount = orderAmount;
    }
    if (
      coupon.maximumDiscountAmount &&
      discount.greaterThan(coupon.maximumDiscountAmount)
    ) {
      discount = coupon.maximumDiscountAmount;
    }
    return discount.toDecimalPlaces(2);
  }

  async recordUsage(input: {
    tx: Prisma.TransactionClient;
    couponId: string;
    userId: string;
    orderId: string;
    discountAmount: Prisma.Decimal;
  }): Promise<void> {
    await input.tx.couponUsage.create({
      data: {
        couponId: input.couponId,
        userId: input.userId,
        orderId: input.orderId,
        discountAmount: input.discountAmount,
      },
    });
  }

  private assertCouponRules(
    type: CouponType,
    value: string,
    startsAt: string,
    endsAt: string,
  ): void {
    if (new Date(startsAt) >= new Date(endsAt)) {
      throw new BadRequestException('startsAt must be before endsAt');
    }
    const decimal = new Prisma.Decimal(value);
    if (decimal.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Coupon value must be positive');
    }
    if (type === CouponType.PERCENTAGE && decimal.greaterThan(100)) {
      throw new BadRequestException('Percentage coupon cannot exceed 100');
    }
  }

  private toResponse(coupon: Coupon, usageCount: number): CouponResponseDto {
    return {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      type: coupon.type,
      value: toMoneyString(coupon.value),
      minimumOrderAmount: coupon.minimumOrderAmount
        ? toMoneyString(coupon.minimumOrderAmount)
        : null,
      maximumDiscountAmount: coupon.maximumDiscountAmount
        ? toMoneyString(coupon.maximumDiscountAmount)
        : null,
      usageLimit: coupon.usageLimit,
      perUserLimit: coupon.perUserLimit,
      startsAt: coupon.startsAt.toISOString(),
      endsAt: coupon.endsAt.toISOString(),
      active: coupon.active,
      usageCount,
    };
  }
}
