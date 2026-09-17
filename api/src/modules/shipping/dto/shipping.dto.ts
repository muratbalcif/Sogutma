import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShippingProviderCode, ShippingStatus } from '@prisma/client';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ShipOrderDto {
  @ApiProperty({ example: '1234567890' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  trackingNumber!: string;

  @ApiPropertyOptional({ example: 'https://www.yurticikargo.com/...' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    enum: ShippingProviderCode,
    default: ShippingProviderCode.MANUAL,
  })
  @IsOptional()
  provider?: ShippingProviderCode;
}

export class StartReturnDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  returnReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

export class ShippingResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty({ enum: ShippingProviderCode })
  provider!: ShippingProviderCode;

  @ApiPropertyOptional({ nullable: true })
  trackingNumber!: string | null;

  @ApiPropertyOptional({ nullable: true })
  trackingUrl!: string | null;

  @ApiProperty({ enum: ShippingStatus })
  status!: ShippingStatus;

  @ApiPropertyOptional({ nullable: true })
  shippedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  deliveredAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
