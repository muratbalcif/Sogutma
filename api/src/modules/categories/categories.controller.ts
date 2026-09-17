import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import {
  CategoryResponseDto,
  CategoryTreeNodeDto,
} from './dto/category-response.dto';
import { ProductsService } from '../products/products.service';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { ProductListItemDto } from '../products/dto/product-response.dto';
import { PublicProductQueryDto } from '../products/dto/product-query.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly productsService: ProductsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List active categories as a tree' })
  @ApiOkResponse({ type: [CategoryTreeNodeDto] })
  findTree(): Promise<CategoryTreeNodeDto[]> {
    return this.categoriesService.findPublicTree();
  }

  @Get(':slug/products')
  @ApiOperation({ summary: 'List active products in a category' })
  findProducts(
    @Param('slug') slug: string,
    @Query() query: PublicProductQueryDto,
  ): Promise<PaginatedResponseDto<ProductListItemDto>> {
    return this.productsService.findPublicByCategorySlug(slug, query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get an active category by slug' })
  @ApiOkResponse({ type: CategoryResponseDto })
  findBySlug(@Param('slug') slug: string): Promise<CategoryResponseDto> {
    return this.categoriesService.findPublicBySlug(slug);
  }
}
