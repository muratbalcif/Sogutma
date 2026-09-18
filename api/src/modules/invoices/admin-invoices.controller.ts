import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Request } from 'express';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreateInvoiceFromSaleDto,
  InvoiceFromSaleResponseDto,
} from './dto/create-invoice-from-sale.dto';
import {
  FormalizeInvoiceDto,
  FormalizeInvoiceResponseDto,
} from './dto/formalize-invoice.dto';
import { InvoiceSyncResponseDto } from './dto/invoice-document.dto';
import {
  AdminInvoiceListQueryDto,
  InvoiceDetailDto,
  InvoiceListItemDto,
} from './dto/invoice-query.dto';
import { InvoiceDocumentService } from './invoice-document.service';
import { InvoiceFormalizeService } from './invoice-formalize.service';
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

  @ApiProperty({
    description:
      'OK | NOT_CONFIGURED | UNAUTHORIZED | FORBIDDEN | UPSTREAM | UNKNOWN',
  })
  code!: string;
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
    private readonly invoiceFormalizeService: InvoiceFormalizeService,
    private readonly invoiceDocumentService: InvoiceDocumentService,
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

  @Get()
  @Permissions('invoice.read')
  @ApiOperation({ summary: 'List invoices (admin)' })
  @ApiOkResponse({ type: PaginatedResponseDto })
  list(
    @Query() query: AdminInvoiceListQueryDto,
  ): Promise<PaginatedResponseDto<InvoiceListItemDto>> {
    return this.invoicesService.list(query);
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

  @Get(':invoiceId/pdf')
  @Permissions('invoice.read')
  @ApiOperation({
    summary: 'Download invoice PDF via KolayBi e-document/view',
    description:
      'Proxies KolayBi GET /invoices/e-document/view?uuid=&output_type=pdf. Requires formalized uuid. Does not expose provider credentials or URLs to the client.',
  })
  @ApiProduces('application/pdf')
  async getPdf(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<StreamableFile> {
    const doc = await this.invoiceDocumentService.getDocument(invoiceId, 'pdf');
    return new StreamableFile(doc.body, {
      type: doc.contentType,
      disposition: `inline; filename="${doc.filename}"`,
    });
  }

  @Get(':invoiceId/xml')
  @Permissions('invoice.read')
  @ApiOperation({
    summary: 'Download invoice UBL-XML via KolayBi e-document/view',
    description:
      'Proxies KolayBi GET /invoices/e-document/view?uuid=&output_type=xml (documented). Requires formalized uuid.',
  })
  @ApiProduces('application/xml')
  async getXml(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<StreamableFile> {
    const doc = await this.invoiceDocumentService.getDocument(invoiceId, 'xml');
    return new StreamableFile(doc.body, {
      type: doc.contentType,
      disposition: `attachment; filename="${doc.filename}"`,
    });
  }

  @Post(':invoiceId/sync')
  @Permissions('invoice.read')
  @ApiOperation({
    summary: 'Sync local Invoice uuid/number from KolayBi',
    description:
      'Uses documented GET /invoices/{document_id} + GET /invoices?description=. Does not change Sale/stock/payment. Provider e-document status is returned ephemerally (not persisted — no migration).',
  })
  @ApiOkResponse({ type: InvoiceSyncResponseDto })
  sync(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<InvoiceSyncResponseDto> {
    return this.invoiceDocumentService.syncFromProvider(invoiceId);
  }

  @Post(':invoiceId/formalize')
  @Permissions('invoice.create')
  @ApiOperation({
    summary: 'Formalize KolayBi draft invoice as e-document',
    description:
      'Calls KolayBi POST /invoices/e-document/create. Stores GİB uuid (ETTN) and formalized invoice number. Does not change Sale/stock/payment. Scenario (e-Fatura vs e-Arşiv) is chosen by KolayBi from the associate.',
  })
  @ApiOkResponse({ type: FormalizeInvoiceResponseDto })
  formalize(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: FormalizeInvoiceDto,
  ): Promise<FormalizeInvoiceResponseDto> {
    return this.invoiceFormalizeService.formalize(
      invoiceId,
      request.user.id,
      dto,
    );
  }

  @Get(':invoiceId')
  @Permissions('invoice.read')
  @ApiOperation({ summary: 'Invoice detail (admin)' })
  @ApiOkResponse({ type: InvoiceDetailDto })
  getById(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<InvoiceDetailDto> {
    return this.invoicesService.getDetail(invoiceId);
  }
}
