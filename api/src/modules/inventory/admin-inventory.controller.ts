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
import {
  PaginatedResponseDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  AdjustStockDto,
  CriticalInventoryItemDto,
  InventoryResponseDto,
  InventoryTransactionResponseDto,
  StockQuantityDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('admin-inventory')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Permissions('stock.read')
  @ApiOperation({ summary: 'List inventory records' })
  findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<InventoryResponseDto>> {
    return this.inventoryService.findAll(query);
  }

  @Get('critical')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'List products at or below minimum stock' })
  @ApiOkResponse({ type: [CriticalInventoryItemDto] })
  findCritical(): Promise<CriticalInventoryItemDto[]> {
    return this.inventoryService.findCritical();
  }

  @Get(':productId')
  @Permissions('stock.read')
  @ApiOkResponse({ type: InventoryResponseDto })
  findOne(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<InventoryResponseDto> {
    return this.inventoryService.getInventory(productId);
  }

  @Get(':productId/transactions')
  @Permissions('stock.read')
  findTransactions(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<InventoryTransactionResponseDto>> {
    return this.inventoryService.getTransactions(productId, query);
  }

  @Post(':productId/increase')
  @Permissions('stock.update')
  increase(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: StockQuantityDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<InventoryResponseDto> {
    return this.inventoryService.increaseStock(productId, dto.quantity, {
      note: dto.note,
      createdBy: request.user.id,
    });
  }

  @Post(':productId/decrease')
  @Permissions('stock.update')
  decrease(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: StockQuantityDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<InventoryResponseDto> {
    return this.inventoryService.decreaseStock(productId, dto.quantity, {
      note: dto.note,
      createdBy: request.user.id,
    });
  }

  @Post(':productId/adjust')
  @Permissions('stock.update')
  adjust(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: AdjustStockDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<InventoryResponseDto> {
    return this.inventoryService.adjustStock(productId, dto.quantity, {
      note: dto.note,
      createdBy: request.user.id,
    });
  }
}
