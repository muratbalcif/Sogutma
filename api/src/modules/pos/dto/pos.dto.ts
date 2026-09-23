import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PosPaymentMethod,
  PosPaymentStatus,
  PosSaleStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CreatePosSaleItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Optional line discount (tax-inclusive TRY). Default 0.',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;
}

export class CreatePosPaymentDto {
  @ApiProperty({ enum: PosPaymentMethod })
  @IsEnum(PosPaymentMethod)
  method!: PosPaymentMethod;

  @ApiProperty({
    example: 100.5,
    description: 'Payment amount (tax-inclusive TRY)',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceNumber?: string;
}

export class CreatePosSaleDto {
  @ApiProperty({ format: 'uuid', description: 'Active POS register id' })
  @IsUUID()
  registerId!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Optional customer user id. Null/omit = misafir satış.',
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  customerId?: string | null;

  @ApiProperty({ type: [CreatePosSaleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePosSaleItemDto)
  items!: CreatePosSaleItemDto[];

  @ApiProperty({
    type: [CreatePosPaymentDto],
    description: 'One or more payments; amounts must sum to grandTotal.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePosPaymentDto)
  payments!: CreatePosPaymentDto[];

  @ApiPropertyOptional({
    description:
      'Cart-level discount amount (tax-inclusive). Requires pos.discount.',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cartDiscountAmount?: number;

  @ApiPropertyOptional({
    description:
      'Cart-level percent discount 0–100. Applied on line subtotal before amount discount. Requires pos.discount.',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  cartDiscountPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class PosProductLookupQueryDto {
  @ApiProperty({
    description: 'Barcode, SKU, or product name (exact barcode preferred)',
    example: '8691234567890',
  })
  @IsString()
  @MaxLength(120)
  q!: string;
}

export class PosPersonDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;
}

export class PosRegisterDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({ nullable: true })
  openedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  closedAt!: string | null;
}

export class PosSaleItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  productId!: string | null;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  sku!: string;

  @ApiPropertyOptional({ nullable: true })
  barcode!: string | null;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ description: 'Already returned quantity' })
  returnedQuantity!: number;

  @ApiProperty({ description: 'quantity - returnedQuantity' })
  returnableQuantity!: number;

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

export class PosPaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PosPaymentMethod })
  method!: PosPaymentMethod;

  @ApiProperty()
  amount!: string;

  @ApiProperty({ enum: PosPaymentStatus })
  status!: PosPaymentStatus;

  @ApiPropertyOptional({ nullable: true })
  referenceNumber!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class PosAccountSnapshotDto {
  @ApiProperty({ description: 'balance = debit - credit' })
  balance!: string;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  creditLimit!: string | null;

  @ApiProperty()
  allowCredit!: boolean;
}

export class PosSaleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'POS-20260923-000001' })
  saleNumber!: string;

  @ApiProperty()
  registerId!: string;

  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional({ nullable: true })
  customerId!: string | null;

  @ApiProperty({ enum: PosSaleStatus })
  status!: PosSaleStatus;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  subtotal!: string;

  @ApiProperty()
  discountTotal!: string;

  @ApiProperty()
  taxTotal!: string;

  @ApiProperty()
  grandTotal!: string;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idempotencyKey!: string | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: [PosSaleItemResponseDto] })
  items!: PosSaleItemResponseDto[];

  @ApiProperty({ type: [PosPaymentResponseDto] })
  payments!: PosPaymentResponseDto[];

  @ApiPropertyOptional({ type: PosPersonDto, nullable: true })
  customer!: PosPersonDto | null;

  @ApiPropertyOptional({ type: PosPersonDto })
  cashier!: PosPersonDto | null;

  @ApiPropertyOptional({ type: PosRegisterDto })
  register!: PosRegisterDto | null;

  @ApiPropertyOptional({
    type: PosAccountSnapshotDto,
    nullable: true,
    description:
      'Müşteri cari özeti (sale sonrası). Misafir satışta null. Client balance göndermez.',
  })
  account!: PosAccountSnapshotDto | null;
}

export class PosProductLookupDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  sku!: string;

  @ApiPropertyOptional({ nullable: true })
  barcode!: string | null;

  @ApiProperty()
  vatRate!: string;

  @ApiPropertyOptional({
    description: 'Resolved unit price (tax-inclusive) when available',
    nullable: true,
  })
  unitPrice!: string | null;

  @ApiProperty()
  availableStock!: number;
}
