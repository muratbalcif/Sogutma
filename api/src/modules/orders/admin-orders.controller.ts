import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { ShipOrderDto, StartReturnDto } from '../shipping/dto/shipping.dto';
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
  @ApiOperation({
    summary: 'Admin list orders',
    description:
      'Server-side filters: status, paymentStatus, date range, search (order # / email / phone / name), sorting, pagination.',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  list(
    @Query() query: AdminOrderListQueryDto,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    return this.ordersService.listAdmin(query);
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
  @ApiOperation({
    summary: 'Admin update order status',
    description:
      'Validates transition matrix. For SHIPPED use POST :id/ship with tracking.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  updateStatus(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.updateStatusAdmin(id, request.user.id, dto);
  }

  @Post(':id/ship')
  @Permissions('order.update')
  @ApiOperation({
    summary: 'Ship order with manual tracking',
    description:
      'Creates/updates Shipping (MANUAL), transitions order to SHIPPED, history + notifications + email outbox.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  ship(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShipOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.shipOrderAdmin(id, request.user.id, dto);
  }

  @Post(':id/deliver')
  @Permissions('order.update')
  @ApiOperation({ summary: 'Mark order delivered' })
  @ApiOkResponse({ type: OrderResponseDto })
  deliver(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { note?: string },
  ): Promise<OrderResponseDto> {
    return this.ordersService.deliverOrderAdmin(
      id,
      request.user.id,
      body?.note,
    );
  }

  @Post(':id/return')
  @Permissions('order.update')
  @ApiOperation({
    summary: 'Start return (foundation)',
    description:
      'Transitions DELIVERED → RETURNED and stores returnReason/adminNote.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  startReturn(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartReturnDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.startReturnAdmin(id, request.user.id, dto);
  }
}
