import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PosPaymentMethod, PosSaleStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PosReturnItemInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  saleItemId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class PosReturnPaymentInputDto {
  @ApiProperty({ enum: PosPaymentMethod })
  @IsEnum(PosPaymentMethod)
  method!: PosPaymentMethod;

  @ApiProperty({ example: 10.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}

export class CreatePosReturnDto {
  @ApiProperty({ type: [PosReturnItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosReturnItemInputDto)
  items!: PosReturnItemInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({
    type: [PosReturnPaymentInputDto],
    description:
      'Optional refund tenders. If omitted, backend allocates (ON_ACCOUNT first, then other methods).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosReturnPaymentInputDto)
  payments?: PosReturnPaymentInputDto[];
}

export class PosReturnItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  saleItemId!: string;

  @ApiPropertyOptional({ nullable: true })
  productId!: string | null;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  lineRefund!: string;
}

export class PosReturnPaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PosPaymentMethod })
  method!: PosPaymentMethod;

  @ApiProperty()
  amount!: string;
}

export class PosReturnResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  saleId!: string;

  @ApiProperty()
  saleNumber!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  totalAmount!: string;

  @ApiPropertyOptional({ nullable: true })
  reason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ enum: PosSaleStatus })
  saleStatus!: PosSaleStatus;

  @ApiProperty({ type: [PosReturnItemResponseDto] })
  items!: PosReturnItemResponseDto[];

  @ApiProperty({ type: [PosReturnPaymentResponseDto] })
  payments!: PosReturnPaymentResponseDto[];
}

export class AdminPosReportQueryDto {
  @ApiProperty({ example: '2026-09-01', description: 'Inclusive (YYYY-MM-DD)' })
  @IsDateString()
  from!: string;

  @ApiProperty({
    example: '2026-09-24',
    description:
      'Exclusive end date (YYYY-MM-DD) — day after last included day',
  })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  registerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Cashier user id' })
  @IsOptional()
  @IsUUID()
  cashierId?: string;
}

export class AdminPosXReportQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  registerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cashierId?: string;
}

export class PosPaymentBreakdownDto {
  @ApiProperty({ enum: PosPaymentMethod })
  method!: PosPaymentMethod;

  @ApiProperty()
  count!: number;

  @ApiProperty()
  amount!: string;
}

export class PosRegisterBreakdownDto {
  @ApiProperty()
  registerId!: string;

  @ApiProperty()
  registerCode!: string;

  @ApiProperty()
  registerName!: string;

  @ApiProperty()
  saleCount!: number;

  @ApiProperty()
  revenue!: string;
}

export class PosCashierBreakdownDto {
  @ApiProperty()
  cashierId!: string;

  @ApiProperty()
  cashierName!: string;

  @ApiProperty()
  saleCount!: number;

  @ApiProperty()
  revenue!: string;
}

export class AdminPosReportSummaryDto {
  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;

  @ApiProperty()
  timezone!: string;

  @ApiProperty({ description: 'Completed + partially returned sales count' })
  totalSales!: number;

  @ApiProperty({ description: 'Gross sales (sale grandTotal sum)' })
  grossSales!: string;

  @ApiProperty({ description: 'Return total in range' })
  returns!: string;

  @ApiProperty({ description: 'grossSales - returns' })
  netSales!: string;

  @ApiProperty()
  totalItems!: number;

  @ApiProperty()
  averageBasket!: string;

  @ApiProperty()
  returnCount!: number;

  @ApiProperty({ type: [PosPaymentBreakdownDto] })
  paymentBreakdown!: PosPaymentBreakdownDto[];

  @ApiProperty({ type: [PosRegisterBreakdownDto] })
  registerBreakdown!: PosRegisterBreakdownDto[];

  @ApiProperty({ type: [PosCashierBreakdownDto] })
  cashierBreakdown!: PosCashierBreakdownDto[];
}
