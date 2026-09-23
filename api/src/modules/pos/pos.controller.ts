import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreatePosSaleDto,
  PosProductLookupDto,
  PosProductLookupQueryDto,
  PosRegisterDto,
  PosSaleResponseDto,
} from './dto/pos.dto';
import { CreatePosReturnDto, PosReturnResponseDto } from './dto/pos-phase5.dto';
import { PosReturnService } from './pos-return.service';
import { PosService } from './pos.service';

@ApiTags('pos')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('pos')
export class PosController {
  constructor(
    private readonly posService: PosService,
    private readonly posReturns: PosReturnService,
  ) {}

  @Get('registers')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Aktif POS kasaları' })
  @ApiOkResponse({ type: [PosRegisterDto] })
  listRegisters(): Promise<PosRegisterDto[]> {
    return this.posService.listRegisters();
  }

  @Get('products/lookup')
  @Permissions('pos.sell')
  @ApiOperation({
    summary: 'Barkod / SKU / ürün adı ile ürün ara (fiyat backend’den)',
  })
  @ApiOkResponse({ type: [PosProductLookupDto] })
  lookup(
    @Query() query: PosProductLookupQueryDto,
    @Query('customerId') customerId?: string,
  ): Promise<PosProductLookupDto[]> {
    return this.posService.lookupProduct(query.q, customerId);
  }

  @Get('sales/by-number/:saleNumber')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Satış numarası ile POS satış getir' })
  @ApiOkResponse({ type: PosSaleResponseDto })
  async getSaleByNumber(
    @Param('saleNumber') saleNumber: string,
  ): Promise<PosSaleResponseDto> {
    const sale = await this.posService.getSaleByNumber(saleNumber);
    if (!sale) throw new NotFoundException('POS satış bulunamadı');
    return sale;
  }

  @Get('sales/:id')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'POS satış detayı' })
  @ApiOkResponse({ type: PosSaleResponseDto })
  getSale(@Param('id', ParseUUIDPipe) id: string): Promise<PosSaleResponseDto> {
    return this.posService.getSaleById(id);
  }

  @Post('sales')
  @Permissions('pos.sell')
  @ApiOperation({
    summary: 'POS satışını tek transaction’da tamamla',
    description:
      'Fiyat, stok, ödeme toplamı backend’de doğrulanır. Idempotency-Key desteklenir. ' +
      'Müşterili satışlarda AccountTransaction: SALE:POS:{id} (DEBIT) + PAYMENT:POS:{paymentId} (CREDIT); ' +
      'ON_ACCOUNT yalnızca DEBIT. Misafir satışta cari kaydı yok.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Retry güvenliği — aynı key ikinci satış oluşturmaz',
  })
  @ApiOkResponse({ type: PosSaleResponseDto })
  createSale(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CreatePosSaleDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<PosSaleResponseDto> {
    return this.posService.createSale(
      dto,
      request.user,
      idempotencyKey ?? null,
    );
  }

  @Post('sales/:id/returns')
  @Permissions('pos.refund')
  @ApiOperation({ summary: 'POS satış iadesi (partial/full)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
  })
  @ApiOkResponse({ type: PosReturnResponseDto })
  createReturn(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePosReturnDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<PosReturnResponseDto> {
    return this.posReturns.createReturn(
      id,
      dto,
      request.user,
      idempotencyKey ?? null,
    );
  }
}
