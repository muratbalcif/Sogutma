import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PriceService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from './coupons.service';
import { CouponValidationResultDto, ValidateCouponDto } from './dto/coupon.dto';

@ApiTags('coupons')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard)
@Controller()
export class CouponsController {
  constructor(
    private readonly couponsService: CouponsService,
    private readonly prisma: PrismaService,
    private readonly priceService: PriceService,
  ) {}

  @Post('checkout/coupon/validate')
  @ApiOperation({
    summary: 'Validate coupon against the authenticated user cart',
    description:
      'Client sends only couponCode. Discount is calculated server-side.',
  })
  @ApiOkResponse({ type: CouponValidationResultDto })
  async validateCheckout(
    @Body() dto: ValidateCouponDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CouponValidationResultDto> {
    const orderAmount = dto.orderAmount
      ? new Prisma.Decimal(dto.orderAmount)
      : await this.resolveCartSubtotal(request.user);
    return this.couponsService.validateForUser({
      code: dto.code,
      userId: request.user.id,
      orderAmount,
    });
  }

  @Post('coupon/validate')
  @ApiOperation({ summary: 'Alias: validate coupon code' })
  @ApiOkResponse({ type: CouponValidationResultDto })
  async validate(
    @Body() dto: ValidateCouponDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CouponValidationResultDto> {
    return this.validateCheckout(dto, request);
  }

  private async resolveCartSubtotal(
    user: AuthenticatedUser,
  ): Promise<Prisma.Decimal> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: true },
    });
    if (!cart || cart.items.length === 0) {
      return new Prisma.Decimal(0);
    }
    const prices = await this.priceService.resolvePricesForProducts(
      cart.items.map((i) => i.productId),
      { customerId: user.id, userType: user.userType },
    );
    let total = new Prisma.Decimal(0);
    for (const item of cart.items) {
      const price = prices.get(item.productId);
      if (!price) continue;
      total = total.add(new Prisma.Decimal(price.amount).mul(item.quantity));
    }
    return total;
  }
}
