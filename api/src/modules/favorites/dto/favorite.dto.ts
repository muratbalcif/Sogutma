import { ApiProperty } from '@nestjs/swagger';

export class FavoriteProductSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ type: [Object] })
  images!: Array<{
    id: string;
    url: string;
    alt: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }>;
}

export class FavoriteResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: FavoriteProductSummaryDto })
  product!: FavoriteProductSummaryDto;
}

export class FavoriteCheckResponseDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  isFavorite!: boolean;
}
