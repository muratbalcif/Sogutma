import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BrandsService } from './brands.service';
import { BrandResponseDto } from './dto/brand.dto';

@ApiTags('brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @ApiOperation({ summary: 'List active brands' })
  @ApiOkResponse({ type: [BrandResponseDto] })
  findAll(): Promise<BrandResponseDto[]> {
    return this.brandsService.findPublicAll();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get an active brand by slug' })
  @ApiOkResponse({ type: BrandResponseDto })
  findBySlug(@Param('slug') slug: string): Promise<BrandResponseDto> {
    return this.brandsService.findPublicBySlug(slug);
  }
}
