import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AddressSnapshot } from '../../addresses/dto/address.dto';
import { PublicBankAccountDto } from '../../payments/dto/payment.dto';
import { ShippingResponseDto } from '../../shipping/dto/shipping.dto';

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

  @ApiPropertyOptional({
    description: 'Coupon code only — discount is calculated on the server',
    example: 'FURKAN10',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;
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

  @ApiPropertyOptional({ example: 'FURKAN10' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;
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

  @ApiProperty({ description: 'Campaign/line discounts + coupon' })
  discount!: string;

  @ApiPropertyOptional({ description: 'Coupon portion of discount' })
  couponDiscount?: string;

  @ApiPropertyOptional()
  couponCode?: string | null;

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

  @ApiProperty({ enum: PaymentMethod })
  method!: PaymentMethod;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  provider!: string | null;

  @ApiPropertyOptional({ nullable: true })
  expiresAt!: Date | null;

  @ApiPropertyOptional()
  approvedTotal?: string;

  @ApiPropertyOptional()
  remainingAmount?: string;

  @ApiPropertyOptional({ nullable: true })
  paymentReference!: string | null;

  /** Present when a PENDING bank-transfer claim exists for this payment. */
  @ApiPropertyOptional({ nullable: true })
  pendingBankTransferId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  pendingBankTransferAmount!: string | null;

  @ApiPropertyOptional({ nullable: true })
  pendingBankTransferBankName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  pendingBankTransferReference!: string | null;
}

export class OrderCustomerResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;
}

export class OrderReturnResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  returnReason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  adminNote!: string | null;

  @ApiProperty()
  createdAt!: Date;
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

  @ApiPropertyOptional({ type: ShippingResponseDto, nullable: true })
  shipping!: ShippingResponseDto | null;

  @ApiPropertyOptional({ type: OrderCustomerResponseDto })
  customer?: OrderCustomerResponseDto;

  @ApiPropertyOptional({ type: OrderReturnResponseDto, nullable: true })
  orderReturn?: OrderReturnResponseDto | null;

  @ApiProperty({ type: [String], enum: OrderStatus })
  allowedTransitions!: OrderStatus[];

  @ApiProperty()
  canCancel!: boolean;

  @ApiPropertyOptional({ type: [PublicBankAccountDto] })
  bankAccounts?: PublicBankAccountDto[];

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

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ description: 'ISO date from' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date to' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Order number, customer email, phone, or name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'totalAmount', 'orderNumber'] })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'totalAmount' | 'orderNumber';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
