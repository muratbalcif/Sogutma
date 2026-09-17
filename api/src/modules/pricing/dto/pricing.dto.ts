import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PriceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateProductPriceDto {
  @ApiProperty({ enum: PriceType })
  @IsEnum(PriceType)
  type!: PriceType;

  @ApiProperty({ example: '24999.90' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toFixed(2) : value,
  )
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'price must be a positive decimal with up to 2 fraction digits',
  })
  price!: string;

  @ApiPropertyOptional({ default: 'TRY' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  currency?: string = 'TRY';

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProductPriceDto {
  @ApiPropertyOptional({ example: '19999.90' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toFixed(2) : value,
  )
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  price?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  validFrom?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateCustomerPriceDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[0-9a-fA-F-]{36}$/)
  productId!: string;

  @ApiProperty({ example: '700.00' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toFixed(2) : value,
  )
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  price!: string;

  @ApiPropertyOptional({ default: 'TRY' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string = 'TRY';

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCustomerPriceDto {
  @ApiPropertyOptional({ example: '650.00' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toFixed(2) : value,
  )
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  price?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  validFrom?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ResolvedPriceDto {
  @ApiProperty({ example: '12990.00', description: 'Final payable unit price' })
  amount!: string;

  @ApiProperty({
    example: '15000.00',
    description: 'Retail/base reference when available',
  })
  basePrice!: string;

  @ApiProperty({
    example: '12990.00',
    description: 'Alias of amount for clients',
  })
  finalPrice!: string;

  @ApiProperty({ example: '2010.00' })
  discountAmount!: string;

  @ApiProperty({ example: '13.40' })
  discountPercentage!: string;

  @ApiProperty({ example: 'TRY' })
  currency!: string;

  @ApiProperty({ example: 'CAMPAIGN' })
  type!: PriceType | 'CUSTOMER';

  @ApiPropertyOptional({ nullable: true })
  campaignId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Validity end of the winning price source when known',
  })
  validUntil?: string | null;
}

export class ProductPriceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty({ enum: PriceType })
  type!: PriceType;

  @ApiProperty()
  price!: string;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  validFrom!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  validTo!: Date | null;

  @ApiProperty()
  active!: boolean;
}

export class CustomerPriceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  price!: string;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  validFrom!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  validTo!: Date | null;

  @ApiProperty()
  active!: boolean;
}
