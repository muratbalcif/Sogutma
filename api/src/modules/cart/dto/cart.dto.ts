import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ example: 3, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CartProductSummaryDto {
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

export class CartItemResponseDto {
  @ApiProperty({ type: CartProductSummaryDto })
  product!: CartProductSummaryDto;

  @ApiProperty()
  quantity!: number;

  @ApiPropertyOptional({ nullable: true, example: '2499.90' })
  unitPrice!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'TRY' })
  currency!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '4999.80' })
  subtotal!: string | null;

  @ApiProperty()
  availableQuantity!: number;

  @ApiProperty()
  available!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    enum: [
      'PRODUCT_NOT_FOUND',
      'PRODUCT_INACTIVE',
      'PRICE_UNAVAILABLE',
      'INSUFFICIENT_STOCK',
      'INVALID_QUANTITY',
    ],
  })
  issueCode!: CartIssueCode | null;
}

export class CartSummaryDto {
  @ApiProperty({ example: '4999.80' })
  subtotal!: string;

  @ApiProperty({ example: '0.00' })
  discount!: string;

  @ApiProperty({ example: '4999.80' })
  total!: string;

  @ApiProperty({ example: 'TRY' })
  currency!: string;
}

export class CartResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: [CartItemResponseDto] })
  items!: CartItemResponseDto[];

  @ApiProperty({ type: CartSummaryDto })
  summary!: CartSummaryDto;
}

export type CartIssueCode =
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'PRICE_UNAVAILABLE'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_QUANTITY';

export class CartValidationIssueDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty({
    enum: [
      'PRODUCT_NOT_FOUND',
      'PRODUCT_INACTIVE',
      'PRICE_UNAVAILABLE',
      'INSUFFICIENT_STOCK',
      'INVALID_QUANTITY',
    ],
  })
  code!: CartIssueCode;

  @ApiProperty()
  message!: string;
}

export class CartValidationResponseDto {
  @ApiProperty()
  valid!: boolean;

  @ApiProperty({ type: [CartValidationIssueDto] })
  issues!: CartValidationIssueDto[];
}
