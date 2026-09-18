import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BankTransferStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    enum: PaymentMethod,
    description: 'v1 supports BANK_TRANSFER only',
  })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}

export class CreateBankTransferDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Selected company bank account to receive the transfer',
  })
  @IsUUID()
  bankAccountId!: string;

  @ApiPropertyOptional({
    description:
      'Optional partial amount. Defaults to remaining balance. Must be <= remaining.',
    example: '9000.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a decimal string' })
  amount?: string;

  @ApiPropertyOptional({
    description: 'Legacy field; ignored for claims (server sets display name)',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  senderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^TR[0-9]{24}$/i, {
    message: 'senderIban must be a valid TR IBAN',
  })
  senderIban?: string;

  @ApiPropertyOptional({
    description: 'Legacy; defaults to today for claim records',
  })
  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectBankTransferDto {
  @ApiProperty({ example: 'Tutar uyuşmuyor' })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  rejectionReason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

export class ApproveBankTransferDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

export class PublicBankAccountDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  bankName!: string;

  @ApiProperty()
  accountName!: string;

  @ApiProperty()
  iban!: string;

  @ApiPropertyOptional({ nullable: true })
  branch!: string | null;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  sortOrder!: number;
}

export class AdminUpsertBankAccountDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  bankName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  accountName!: string;

  @ApiProperty({ example: 'TR330006100519786457841326' })
  @IsString()
  @Matches(/^TR[0-9]{24}$/i)
  iban!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  branch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  accountNumber?: string;

  @ApiPropertyOptional({ default: 'TRY' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class PaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty({ enum: PaymentMethod })
  method!: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  provider!: string | null;

  @ApiPropertyOptional({ nullable: true })
  providerPaymentId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idempotencyKey!: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureMessage!: string | null;

  @ApiPropertyOptional({ nullable: true })
  paidAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  expiresAt!: Date | null;

  /** Pending bank-transfer notification id when admin can approve from payments UI. */
  @ApiPropertyOptional({ nullable: true })
  pendingBankTransferId!: string | null;

  @ApiPropertyOptional({
    description: 'Sum of APPROVED bank-transfer notifications',
  })
  approvedTotal?: string;

  @ApiPropertyOptional({
    description: 'order.totalAmount - approvedTotal (floored at 0)',
  })
  remainingAmount?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Customer-facing bank transfer description reference',
  })
  paymentReference!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class BankTransferTimelineItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty({ enum: BankTransferStatus })
  status!: BankTransferStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  verifiedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  rejectionReason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  referenceNumber!: string | null;
}

export class BankTransferResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  paymentId!: string;

  @ApiPropertyOptional({ nullable: true })
  bankAccountId!: string | null;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  amountMismatch!: boolean;

  @ApiProperty()
  orderTotal!: string;

  @ApiProperty({ description: 'Sum of APPROVED notifications for this order' })
  approvedTotal!: string;

  @ApiProperty({ description: 'Remaining balance to pay' })
  remainingAmount!: string;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus!: PaymentStatus;

  @ApiProperty()
  senderName!: string;

  @ApiPropertyOptional({ nullable: true })
  senderIban!: string | null;

  @ApiProperty()
  transferDate!: Date;

  @ApiPropertyOptional({ nullable: true })
  referenceNumber!: string | null;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiProperty({ enum: BankTransferStatus })
  status!: BankTransferStatus;

  @ApiPropertyOptional({ nullable: true })
  rejectionReason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  adminNote!: string | null;

  @ApiPropertyOptional({ nullable: true })
  verifiedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  orderNumber?: string;

  @ApiPropertyOptional()
  customerName?: string;

  @ApiPropertyOptional()
  bankName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  bankIban?: string | null;

  /** Sibling notifications for the same order (partial payment timeline). */
  @ApiPropertyOptional({ type: [BankTransferTimelineItemDto] })
  timeline?: BankTransferTimelineItemDto[];
}

export class CurrentAccountResponseDto {
  @ApiProperty()
  totalDebit!: string;

  @ApiProperty()
  totalCredit!: string;

  @ApiProperty()
  balance!: string;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional()
  overdueAmount?: string;

  @ApiPropertyOptional()
  creditLimit?: string | null;

  @ApiPropertyOptional()
  allowCredit?: boolean;

  @ApiPropertyOptional()
  paymentTermDays?: number | null;
}

export class AdminPaymentListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AdminBankTransferListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: BankTransferStatus })
  @IsOptional()
  @IsEnum(BankTransferStatus)
  status?: BankTransferStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiPropertyOptional({
    description: 'Search order number, customer, or reference',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter claims by company bank account',
  })
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;
}
