import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BrandResponseDto } from '../../brands/dto/brand.dto';
import { PublicStockDto } from '../../inventory/dto/inventory.dto';
import { ResolvedPriceDto } from '../../pricing/dto/pricing.dto';

export class ProductImageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  url!: string;

  @ApiPropertyOptional({ nullable: true })
  objectKey?: string | null;

  @ApiPropertyOptional({ nullable: true })
  alt!: string | null;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  isPrimary!: boolean;
}

export class ProductAttributeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  value!: string;

  @ApiProperty()
  sortOrder!: number;
}

export class ProductCompatibilityResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  manufacturer!: string;

  @ApiProperty()
  model!: string;

  @ApiPropertyOptional({ nullable: true })
  modelYear!: number | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;
}

export class ProductCategorySummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class ProductListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sku!: string;

  @ApiPropertyOptional({ nullable: true })
  barcode!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  vatRate!: string;

  @ApiProperty()
  active!: boolean;

  @ApiPropertyOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional({ nullable: true })
  metaTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  metaDescription?: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: BrandResponseDto })
  brand!: BrandResponseDto;

  @ApiProperty({ type: ProductCategorySummaryDto })
  category!: ProductCategorySummaryDto;

  @ApiProperty({ type: [ProductImageResponseDto] })
  images!: ProductImageResponseDto[];

  @ApiPropertyOptional({ type: ResolvedPriceDto, nullable: true })
  price?: ResolvedPriceDto | null;

  @ApiPropertyOptional({
    type: ResolvedPriceDto,
    nullable: true,
    description: 'Retail reference when a campaign/customer price applies',
  })
  compareAtPrice?: ResolvedPriceDto | null;

  @ApiPropertyOptional({ type: PublicStockDto })
  stock?: PublicStockDto;

  @ApiPropertyOptional({
    description: 'True when resolved price type is CAMPAIGN',
  })
  onCampaign?: boolean;
}

export class ProductDetailDto extends ProductListItemDto {
  @ApiProperty({ type: [ProductAttributeResponseDto] })
  attributes!: ProductAttributeResponseDto[];

  @ApiProperty({ type: [ProductCompatibilityResponseDto] })
  compatibility!: ProductCompatibilityResponseDto[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'Sanitized rich HTML for Teknik Özellikler',
  })
  technicalHtml?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Sanitized rich HTML for Uyumluluk',
  })
  compatibilityHtml?: string | null;
}
