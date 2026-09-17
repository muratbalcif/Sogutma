import {
  Body,
  Controller,
  Delete,
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
import { AuditService } from '../audit/audit.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreateCustomerPriceDto,
  CreateProductPriceDto,
  CustomerPriceResponseDto,
  ProductPriceResponseDto,
  UpdateCustomerPriceDto,
  UpdateProductPriceDto,
} from './dto/pricing.dto';
import { PriceService } from './pricing.service';

@ApiTags('admin-pricing')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/pricing')
export class AdminPricingController {
  constructor(
    private readonly priceService: PriceService,
    private readonly audit: AuditService,
  ) {}

  @Get('products/:productId')
  @Permissions('pricing.read')
  @ApiOperation({ summary: 'List product prices' })
  listProductPrices(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductPriceResponseDto[]> {
    return this.priceService.listProductPrices(productId);
  }

  @Post('products/:productId')
  @Permissions('pricing.create')
  @ApiCreatedResponse({ type: ProductPriceResponseDto })
  createProductPrice(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductPriceDto,
  ): Promise<ProductPriceResponseDto> {
    return this.priceService.createProductPrice(productId, dto);
  }

  @Patch(':priceId')
  @Permissions('pricing.update')
  @ApiOkResponse({ type: ProductPriceResponseDto })
  updateProductPrice(
    @Param('priceId', ParseUUIDPipe) priceId: string,
    @Body() dto: UpdateProductPriceDto,
  ): Promise<ProductPriceResponseDto> {
    return this.priceService.updateProductPrice(priceId, dto);
  }

  @Delete(':priceId')
  @Permissions('pricing.delete')
  @ApiOperation({ summary: 'Deactivate a product price' })
  deactivateProductPrice(
    @Param('priceId', ParseUUIDPipe) priceId: string,
  ): Promise<ProductPriceResponseDto> {
    return this.priceService.deactivateProductPrice(priceId);
  }

  @Get('customers/:customerId')
  @Permissions('pricing.read')
  listCustomerPrices(
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<CustomerPriceResponseDto[]> {
    return this.priceService.listCustomerPrices(customerId);
  }

  @Post('customers/:customerId')
  @Permissions('pricing.create')
  @ApiCreatedResponse({ type: CustomerPriceResponseDto })
  async createCustomerPrice(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateCustomerPriceDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CustomerPriceResponseDto> {
    const created = await this.priceService.createCustomerPrice(
      customerId,
      dto,
    );
    await this.audit.log({
      adminUserId: request.user.id,
      action: 'CUSTOMER_PRICE_CREATED',
      entityType: 'CustomerPrice',
      entityId: created.id,
      metadata: {
        customerId,
        productId: created.productId,
        newPrice: created.price,
      },
    });
    return created;
  }

  @Patch('customer-prices/:id')
  @Permissions('pricing.update')
  async updateCustomerPrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerPriceDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CustomerPriceResponseDto> {
    const updated = await this.priceService.updateCustomerPrice(id, dto);
    await this.audit.log({
      adminUserId: request.user.id,
      action: 'CUSTOMER_PRICE_UPDATED',
      entityType: 'CustomerPrice',
      entityId: id,
      metadata: {
        newPrice: updated.price,
        active: updated.active,
        patch: dto,
      },
    });
    return updated;
  }

  @Delete('customer-prices/:id')
  @Permissions('pricing.delete')
  async deactivateCustomerPrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CustomerPriceResponseDto> {
    const updated = await this.priceService.deactivateCustomerPrice(id);
    await this.audit.log({
      adminUserId: request.user.id,
      action: 'CUSTOMER_PRICE_DELETED',
      entityType: 'CustomerPrice',
      entityId: id,
      metadata: {
        customerId: updated.customerId,
        oldPrice: updated.price,
        active: false,
      },
    });
    return updated;
  }
}
