import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AdminProductQueryDto } from './dto/product-query.dto';
import {
  ProductDetailDto,
  ProductListItemDto,
} from './dto/product-response.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductsService } from './products.service';

@ApiTags('admin-products')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Permissions('product.read')
  @ApiOperation({ summary: 'Admin list products' })
  findAll(
    @Query() query: AdminProductQueryDto,
  ): Promise<PaginatedResponseDto<ProductListItemDto>> {
    return this.productsService.findAllAdmin(query);
  }

  @Get(':id')
  @Permissions('product.read')
  @ApiOkResponse({ type: ProductDetailDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProductDetailDto> {
    return this.productsService.findAdminById(id);
  }

  @Post()
  @Permissions('product.create')
  @ApiCreatedResponse({ type: ProductDetailDto })
  create(@Body() dto: CreateProductDto): Promise<ProductDetailDto> {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @Permissions('product.update')
  @ApiOkResponse({ type: ProductDetailDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDetailDto> {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('product.delete')
  @ApiOperation({ summary: 'Deactivate product (soft delete)' })
  @ApiOkResponse({ type: ProductDetailDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<ProductDetailDto> {
    return this.productsService.softDelete(id);
  }
}
