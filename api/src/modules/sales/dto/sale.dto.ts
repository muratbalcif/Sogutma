import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalePaymentMethod, SaleStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateSaleItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Optional line discount (tax-inclusive). Default 0.',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  discountAmount?: number;
}

export class CreateSaleDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Optional customer user id. Null/omit = perakende satış.',
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  customerId?: string | null;

  @ApiProperty({ type: [CreateSaleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];

  @ApiProperty({ enum: SalePaymentMethod })
  @IsEnum(SalePaymentMethod)
  paymentMethod!: SalePaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CancelSaleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminSaleListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-09-18' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-18' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Customer user id, or "retail" for customerId IS NULL',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  createdById?: string;

  @ApiPropertyOptional({ enum: SalePaymentMethod })
  @IsOptional()
  @IsEnum(SalePaymentMethod)
  paymentMethod?: SalePaymentMethod;

  @ApiPropertyOptional({ enum: SaleStatus })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    description: 'When true, only retail (customerId null) sales',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  retailOnly?: boolean;
}

export class DailySummaryQueryDto {
  @ApiProperty({ example: '2026-09-18' })
  @IsDateString()
  date!: string;
}

export class SaleItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  productId!: string | null;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  unitPrice!: string;

  @ApiProperty()
  discountAmount!: string;

  @ApiProperty()
  taxRate!: string;

  @ApiProperty()
  taxAmount!: string;

  @ApiProperty()
  lineSubtotal!: string;

  @ApiProperty()
  lineTotal!: string;
}

export class SalePersonDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;
}

export class SaleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  saleNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  customerId!: string | null;

  @ApiProperty({
    description: 'Display label; "Perakende Satış" when no customer',
  })
  customerLabel!: string;

  @ApiPropertyOptional({ type: SalePersonDto, nullable: true })
  customer!: SalePersonDto | null;

  @ApiProperty({ type: SalePersonDto })
  createdBy!: SalePersonDto;

  @ApiProperty({ enum: SaleStatus })
  status!: SaleStatus;

  @ApiProperty({ enum: SalePaymentMethod })
  paymentMethod!: SalePaymentMethod;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  subtotal!: string;

  @ApiProperty()
  discountAmount!: string;

  @ApiProperty()
  taxAmount!: string;

  @ApiProperty()
  totalAmount!: string;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiPropertyOptional({ nullable: true })
  cancelledAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  cancelReason!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: [SaleItemResponseDto] })
  items!: SaleItemResponseDto[];

  @ApiProperty()
  itemCount!: number;
}

export class DailySalesSummaryDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  totalSales!: string;

  @ApiProperty()
  saleCount!: number;

  @ApiProperty()
  itemCount!: number;

  @ApiProperty()
  refundTotal!: string;

  @ApiProperty()
  retailSaleCount!: number;

  @ApiProperty()
  customerSaleCount!: number;

  @ApiProperty()
  paymentBreakdown!: {
    cash: string;
    card: string;
    bankTransfer: string;
  };
}
