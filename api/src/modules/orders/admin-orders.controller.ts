import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  AdminOrderListQueryDto,
  OrderResponseDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('admin-orders')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Permissions('order.read')
  @ApiOperation({ summary: 'Admin list orders' })
  @ApiOkResponse({ type: PaginatedResponseDto })
  list(
    @Query() query: AdminOrderListQueryDto,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    return this.ordersService.listAdmin({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
    });
  }

  @Get(':id')
  @Permissions('order.read')
  @ApiOperation({ summary: 'Admin get order detail' })
  @ApiOkResponse({ type: OrderResponseDto })
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<OrderResponseDto> {
    return this.ordersService.getAdminById(id);
  }

  @Patch(':id/status')
  @Permissions('order.update')
  @ApiOperation({ summary: 'Admin update order status' })
  @ApiOkResponse({ type: OrderResponseDto })
  updateStatus(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.updateStatusAdmin(id, request.user.id, dto);
  }
}
