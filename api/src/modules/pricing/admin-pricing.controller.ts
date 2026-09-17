import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
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
  constructor(private readonly priceService: PriceService) {}

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
  createCustomerPrice(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateCustomerPriceDto,
  ): Promise<CustomerPriceResponseDto> {
    return this.priceService.createCustomerPrice(customerId, dto);
  }

  @Patch('customer-prices/:id')
  @Permissions('pricing.update')
  updateCustomerPrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerPriceDto,
  ): Promise<CustomerPriceResponseDto> {
    return this.priceService.updateCustomerPrice(id, dto);
  }

  @Delete('customer-prices/:id')
  @Permissions('pricing.delete')
  deactivateCustomerPrice(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerPriceResponseDto> {
    return this.priceService.deactivateCustomerPrice(id);
  }
}
