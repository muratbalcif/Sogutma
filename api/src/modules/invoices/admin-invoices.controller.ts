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
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Request } from 'express';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreateInvoiceFromSaleDto,
  InvoiceFromSaleResponseDto,
} from './dto/create-invoice-from-sale.dto';
import { InvoiceFromSaleService } from './invoice-from-sale.service';
import { InvoicesService } from './invoices.service';
import { KOLAYBI_INVOICE_PROVIDER } from './providers/invoice-provider.interface';

class ProviderHealthQueryDto {
  @ApiProperty({ required: false, example: 'KOLAYBI' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  provider?: string;
}

class ProviderHealthResponseDto {
  @ApiProperty()
  provider!: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  ok!: boolean;

  @ApiProperty()
  sandbox!: boolean;

  @ApiProperty()
  message!: string;
}

class SyncResultDto {
  @ApiProperty()
  provider!: string;

  @ApiProperty()
  localEntityId!: string;

  @ApiProperty()
  externalId!: string;

  @ApiProperty()
  created!: boolean;

  @ApiProperty()
  verifiedExisting!: boolean;
}

class CustomerSyncResultDto extends SyncResultDto {
  @ApiProperty()
  userId!: string;
}

class AddressSyncResultDto extends SyncResultDto {
  @ApiProperty()
  addressId!: string;

  @ApiProperty()
  userId!: string;
}

class ProductSyncResultDto extends SyncResultDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  sku!: string;
}

@ApiTags('admin-invoices')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/invoices')
export class AdminInvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoiceFromSaleService: InvoiceFromSaleService,
  ) {}

  @Get('provider/health')
  @Permissions('invoice.read')
  @ApiOperation({
    summary: 'Invoice provider health (auth + read-only ping)',
    description:
      'Does not create invoices. Verifies KolayBi credentials and API reachability.',
  })
  @ApiOkResponse({ type: ProviderHealthResponseDto })
  providerHealth(
    @Query() query: ProviderHealthQueryDto,
  ): Promise<ProviderHealthResponseDto> {
    return this.invoicesService.providerHealth(
      query.provider?.trim() || KOLAYBI_INVOICE_PROVIDER,
    );
  }

  @Post('from-sale/:saleId')
  @Permissions('invoice.create')
  @ApiOperation({
    summary: 'Create invoice from completed Sale (KolayBi draft)',
    description:
      'Requires Sale.customerId. Syncs customer/address/products, creates local PENDING Invoice then KolayBi draft. Does not formalize e-Fatura/e-Arşiv or change stock/payment.',
  })
  @ApiOkResponse({ type: InvoiceFromSaleResponseDto })
  createFromSale(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @Body() dto: CreateInvoiceFromSaleDto,
  ): Promise<InvoiceFromSaleResponseDto> {
    return this.invoiceFromSaleService.createFromSale(
      saleId,
      request.user.id,
      dto,
    );
  }

  @Post('provider/:providerCode/customers/:userId/sync')
  @Permissions('invoice.update')
  @ApiOperation({
    summary: 'Sync customer → provider associate (KolayBi)',
    description:
      'Creates or verifies KolayBi associate and stores ExternalEntityLink. Does not create invoices.',
  })
  @ApiOkResponse({ type: CustomerSyncResultDto })
  syncCustomer(
    @Param('providerCode') providerCode: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<CustomerSyncResultDto> {
    return this.invoicesService.syncCustomer(
      userId,
      providerCode.trim().toUpperCase(),
    );
  }

  @Post('provider/:providerCode/addresses/:addressId/sync')
  @Permissions('invoice.update')
  @ApiOperation({
    summary: 'Sync address → provider address (KolayBi)',
    description:
      'Ensures customer associate exists first, then creates/verifies address link.',
  })
  @ApiOkResponse({ type: AddressSyncResultDto })
  syncAddress(
    @Param('providerCode') providerCode: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ): Promise<AddressSyncResultDto> {
    return this.invoicesService.syncAddress(
      addressId,
      providerCode.trim().toUpperCase(),
    );
  }

  @Post('provider/:providerCode/products/:productId/sync')
  @Permissions('invoice.update')
  @ApiOperation({
    summary: 'Sync product → provider product (KolayBi)',
    description:
      'Creates or verifies KolayBi product by SKU/code and stores ExternalEntityLink. Does not create invoices or sync stock/price.',
  })
  @ApiOkResponse({ type: ProductSyncResultDto })
  syncProduct(
    @Param('providerCode') providerCode: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductSyncResultDto> {
    return this.invoicesService.syncProduct(
      productId,
      providerCode.trim().toUpperCase(),
    );
  }
}
