import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AddressSnapshot } from '../../addresses/dto/address.dto';

export class CreateOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  shippingAddressId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  billingAddressId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customerNote?: string;
}

export class CheckoutValidateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  shippingAddressId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  billingAddressId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customerNote?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class OrderIssueDto {
  @ApiProperty()
  code!: string;

  @ApiPropertyOptional()
  productId?: string;

  @ApiProperty()
  message!: string;
}

export class CheckoutItemDto {
  @ApiProperty()
  productId!: string;

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
  taxAmount!: string;

  @ApiProperty()
  subtotal!: string;

  @ApiProperty()
  totalAmount!: string;

  @ApiProperty()
  currency!: string;
}

export class OrderTotalsDto {
  @ApiProperty()
  subtotal!: string;

  @ApiProperty()
  discount!: string;

  @ApiProperty()
  tax!: string;

  @ApiProperty()
  shipping!: string;

  @ApiProperty()
  total!: string;

  @ApiProperty()
  currency!: string;
}

export class CheckoutValidationResponseDto {
  @ApiProperty()
  valid!: boolean;

  @ApiProperty({ type: [CheckoutItemDto] })
  items!: CheckoutItemDto[];

  @ApiPropertyOptional({ type: OrderTotalsDto })
  summary?: OrderTotalsDto;

  @ApiProperty({ type: [OrderIssueDto] })
  issues!: OrderIssueDto[];
}

export class OrderItemResponseDto {
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
  taxAmount!: string;

  @ApiProperty()
  subtotal!: string;

  @ApiProperty()
  totalAmount!: string;
}

export class OrderStatusHistoryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ enum: OrderStatus, nullable: true })
  fromStatus!: OrderStatus | null;

  @ApiProperty({ enum: OrderStatus })
  toStatus!: OrderStatus;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiPropertyOptional({ nullable: true })
  changedBy!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  provider!: string | null;
}

export class OrderResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderNumber!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  subtotal!: string;

  @ApiProperty()
  discountAmount!: string;

  @ApiProperty()
  taxAmount!: string;

  @ApiProperty()
  shippingAmount!: string;

  @ApiProperty()
  totalAmount!: string;

  @ApiPropertyOptional({ nullable: true })
  customerNote!: string | null;

  @ApiProperty({ type: AddressSnapshot })
  shippingAddress!: AddressSnapshot;

  @ApiProperty({ type: AddressSnapshot })
  billingAddress!: AddressSnapshot;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];

  @ApiProperty({ type: [OrderStatusHistoryResponseDto] })
  statusHistory!: OrderStatusHistoryResponseDto[];

  @ApiPropertyOptional({ type: PaymentResponseDto, nullable: true })
  payment!: PaymentResponseDto | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class AdminOrderListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
