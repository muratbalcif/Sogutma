import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class StockQuantityDto {
  @ApiProperty({ example: 10, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AdjustStockDto {
  @ApiProperty({
    example: 25,
    description: 'Absolute stock quantity to set',
    minimum: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class InventoryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  reservedQuantity!: number;

  @ApiProperty()
  availableQuantity!: number;

  @ApiProperty()
  minimumQuantity!: number;
}

export class CriticalInventoryItemDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  reservedQuantity!: number;

  @ApiProperty()
  availableQuantity!: number;

  @ApiProperty()
  minimumQuantity!: number;
}

export class InventoryTransactionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  previousQuantity!: number;

  @ApiProperty()
  newQuantity!: number;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PublicStockDto {
  @ApiProperty()
  available!: boolean;

  @ApiProperty()
  quantity!: number;
}
