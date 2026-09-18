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
  AdminSaleListQueryDto,
  CancelSaleDto,
  CreateSaleDto,
  DailySalesSummaryDto,
  DailySummaryQueryDto,
  SaleResponseDto,
} from './dto/sale.dto';
import { SalesService } from './sales.service';

@ApiTags('admin-sales')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/sales')
export class AdminSalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('daily-summary')
  @Permissions('sale.read')
  @ApiOperation({ summary: 'Günlük satış özeti' })
  @ApiOkResponse({ type: DailySalesSummaryDto })
  dailySummary(
    @Query() query: DailySummaryQueryDto,
  ): Promise<DailySalesSummaryDto> {
    return this.salesService.dailySummary(query.date);
  }

  @Get()
  @Permissions('sale.read')
  @ApiOperation({ summary: 'Satış listesi' })
  @ApiOkResponse({ type: PaginatedResponseDto })
  list(
    @Query() query: AdminSaleListQueryDto,
  ): Promise<PaginatedResponseDto<SaleResponseDto>> {
    return this.salesService.list(query);
  }

  @Get(':id')
  @Permissions('sale.read')
  @ApiOperation({ summary: 'Satış detayı' })
  @ApiOkResponse({ type: SaleResponseDto })
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<SaleResponseDto> {
    return this.salesService.getById(id);
  }

  @Post()
  @Permissions('sale.create')
  @ApiOperation({
    summary: 'Yeni satış (müşteri opsiyonel)',
    description:
      'customerId null/omit = perakende. createdById JWT’den alınır.',
  })
  @ApiOkResponse({ type: SaleResponseDto })
  create(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CreateSaleDto,
  ): Promise<SaleResponseDto> {
    return this.salesService.create(dto, request.user.id);
  }

  @Post(':id/cancel')
  @Permissions('sale.update')
  @ApiOperation({ summary: 'Satışı iptal et (stok iade)' })
  @ApiOkResponse({ type: SaleResponseDto })
  cancel(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSaleDto,
  ): Promise<SaleResponseDto> {
    return this.salesService.cancel(id, request.user.id, dto);
  }
}
