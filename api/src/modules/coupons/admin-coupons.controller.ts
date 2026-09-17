import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CouponsService } from './coupons.service';
import {
  CouponResponseDto,
  CreateCouponDto,
  UpdateCouponDto,
} from './dto/coupon.dto';

@ApiTags('admin-coupons')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @Permissions('campaign.read')
  @ApiOperation({ summary: 'List coupons' })
  list(): Promise<CouponResponseDto[]> {
    return this.couponsService.listAdmin();
  }

  @Get(':id')
  @Permissions('campaign.read')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<CouponResponseDto> {
    return this.couponsService.getAdminById(id);
  }

  @Post()
  @Permissions('campaign.create')
  @ApiCreatedResponse({ type: CouponResponseDto })
  create(
    @Body() dto: CreateCouponDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CouponResponseDto> {
    return this.couponsService.create(dto, request.user.id);
  }

  @Patch(':id')
  @Permissions('campaign.update')
  @ApiOkResponse({ type: CouponResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CouponResponseDto> {
    return this.couponsService.update(id, dto, request.user.id);
  }
}
