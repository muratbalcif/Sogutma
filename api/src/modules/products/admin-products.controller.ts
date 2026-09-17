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
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AdminProductQueryDto } from './dto/product-query.dto';
import {
  ProductDetailDto,
  ProductImageResponseDto,
  ProductListItemDto,
} from './dto/product-response.dto';
import {
  BulkProductStatusDto,
  CreateProductDto,
  RegisterProductImageDto,
  ReorderImagesDto,
  UpdateProductDto,
} from './dto/product.dto';
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

  @Post('bulk-status')
  @Permissions('product.update')
  @ApiOperation({ summary: 'Bulk activate/deactivate products' })
  bulkStatus(
    @Body() dto: BulkProductStatusDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.productsService.bulkSetActive(dto, request.user.id);
  }

  @Post(':id/featured')
  @Permissions('product.update')
  @ApiOperation({ summary: 'Mark product as featured / update sort' })
  setFeatured(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: { isFeatured: boolean; featuredSortOrder?: number },
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.productsService.setFeatured(id, body, request.user.id);
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
  create(
    @Body() dto: CreateProductDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<ProductDetailDto> {
    return this.productsService.create(dto, request.user.id);
  }

  @Patch(':id')
  @Permissions('product.update')
  @ApiOkResponse({ type: ProductDetailDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<ProductDetailDto> {
    return this.productsService.update(id, dto, request.user.id);
  }

  @Delete(':id')
  @Permissions('product.delete')
  @ApiOperation({ summary: 'Deactivate product (soft delete)' })
  @ApiOkResponse({ type: ProductDetailDto })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<ProductDetailDto> {
    return this.productsService.softDelete(id, request.user.id);
  }

  @Post(':id/images')
  @Permissions('product.update')
  @ApiCreatedResponse({ type: ProductImageResponseDto })
  registerImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterProductImageDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<ProductImageResponseDto> {
    return this.productsService.registerImage(id, dto, request.user.id);
  }

  @Delete(':id/images/:imageId')
  @Permissions('product.update')
  deleteImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.productsService.deleteImage(id, imageId, request.user.id);
  }

  @Post(':id/images/reorder')
  @Permissions('product.update')
  reorderImages(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderImagesDto,
  ): Promise<ProductImageResponseDto[]> {
    return this.productsService.reorderImages(id, dto);
  }

  @Post(':id/images/:imageId/primary')
  @Permissions('product.update')
  setPrimary(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<ProductImageResponseDto> {
    return this.productsService.setPrimaryImage(id, imageId);
  }
}
