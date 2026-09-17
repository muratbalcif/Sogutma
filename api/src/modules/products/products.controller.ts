import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { OptionalJwtAccessGuard } from '../auth/guards/optional-jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  ProductSearchQueryDto,
  PublicProductQueryDto,
} from './dto/product-query.dto';
import {
  ProductDetailDto,
  ProductListItemDto,
} from './dto/product-response.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@UseGuards(OptionalJwtAccessGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List active products with filters and pagination' })
  findAll(
    @Query() query: PublicProductQueryDto,
    @Req() request: Request & { user?: AuthenticatedUser },
  ): Promise<PaginatedResponseDto<ProductListItemDto>> {
    return this.productsService.findPublic(query, this.toViewer(request.user));
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search active products by name, SKU, barcode, description',
  })
  search(
    @Query() query: ProductSearchQueryDto,
    @Req() request: Request & { user?: AuthenticatedUser },
  ): Promise<PaginatedResponseDto<ProductListItemDto>> {
    return this.productsService.searchPublic(
      query,
      this.toViewer(request.user),
    );
  }

  @Get('featured')
  @ApiOperation({ summary: 'Featured / recommended products for homepage' })
  @ApiOkResponse({ type: [ProductListItemDto] })
  featured(
    @Req() request: Request & { user?: AuthenticatedUser },
  ): Promise<ProductListItemDto[]> {
    return this.productsService.findFeatured(8, this.toViewer(request.user));
  }

  @Get('best-selling')
  @ApiOperation({ summary: 'Best-selling products based on order quantities' })
  @ApiOkResponse({ type: [ProductListItemDto] })
  bestSelling(
    @Req() request: Request & { user?: AuthenticatedUser },
  ): Promise<ProductListItemDto[]> {
    return this.productsService.findBestSelling(8, this.toViewer(request.user));
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'Products currently in an active campaign' })
  @ApiOkResponse({ type: [ProductListItemDto] })
  campaignProducts(
    @Req() request: Request & { user?: AuthenticatedUser },
  ): Promise<ProductListItemDto[]> {
    return this.productsService.findCampaignProducts(
      8,
      this.toViewer(request.user),
    );
  }

  @Get(':slug/related')
  @ApiOperation({ summary: 'Get related active products' })
  @ApiOkResponse({ type: [ProductListItemDto] })
  findRelated(
    @Param('slug') slug: string,
    @Req() request: Request & { user?: AuthenticatedUser },
  ): Promise<ProductListItemDto[]> {
    return this.productsService.findRelated(
      slug,
      8,
      this.toViewer(request.user),
    );
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get an active product by slug' })
  @ApiOkResponse({ type: ProductDetailDto })
  findBySlug(
    @Param('slug') slug: string,
    @Req() request: Request & { user?: AuthenticatedUser },
  ): Promise<ProductDetailDto> {
    return this.productsService.findPublicBySlug(
      slug,
      this.toViewer(request.user),
    );
  }

  private toViewer(user?: AuthenticatedUser) {
    if (!user) {
      return {};
    }
    return {
      customerId: user.id,
      userType: user.userType,
    };
  }
}
