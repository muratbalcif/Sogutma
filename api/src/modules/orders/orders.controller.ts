import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import {
  PaginatedResponseDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateOrderDto, OrderResponseDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create an order from the authenticated user cart',
    description:
      'Atomic checkout: validates cart, snapshots prices/products/addresses, reserves stock, clears cart. Payment remains PENDING (no provider yet).',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  create(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.create(
      request.user.id,
      request.user.userType,
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List orders for the authenticated user' })
  @ApiOkResponse({ type: PaginatedResponseDto })
  list(
    @Req() request: Request & { user: AuthenticatedUser },
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    return this.ordersService.listForUser(request.user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order detail for the authenticated user' })
  @ApiOkResponse({ type: OrderResponseDto })
  getById(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.getByIdForUser(request.user.id, id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel an order (PENDING or CONFIRMED only)',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  cancel(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.cancelForUser(request.user.id, id);
  }
}
