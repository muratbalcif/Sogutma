import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  AdminPosCashierDto,
  AdminPosSaleDetailDto,
  AdminPosSaleListItemDto,
  AdminPosSaleListQueryDto,
} from './dto/pos-admin.dto';
import { PosAdminService } from './pos-admin.service';

@ApiTags('admin-pos-sales')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/pos')
export class AdminPosSalesController {
  constructor(private readonly posAdmin: PosAdminService) {}

  @Get('cashiers')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'POS kasiyer listesi (filtre için)' })
  @ApiOkResponse({ type: [AdminPosCashierDto] })
  cashiers(): Promise<AdminPosCashierDto[]> {
    return this.posAdmin.listCashiers();
  }

  @Get('sales')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Windows POS satış listesi' })
  @ApiOkResponse({ type: PaginatedResponseDto })
  list(
    @Req() request: Request & { user: AuthenticatedUser },
    @Query() query: AdminPosSaleListQueryDto,
  ): Promise<PaginatedResponseDto<AdminPosSaleListItemDto>> {
    return this.posAdmin.listSales(query, request.user);
  }

  @Get('sales/:id')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Windows POS satış detayı + cari ledger' })
  @ApiOkResponse({ type: AdminPosSaleDetailDto })
  detail(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminPosSaleDetailDto> {
    return this.posAdmin.getSaleDetail(id, request.user);
  }
}
