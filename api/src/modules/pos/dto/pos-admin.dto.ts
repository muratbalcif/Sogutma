import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PosPaymentMethod, PosSaleStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { PosRegisterDto, PosSaleResponseDto } from './pos.dto';

export class AdminPosRegisterDto extends PosRegisterDto {
  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class AdminPosCashierDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;
}

export class CreatePosRegisterDto {
  @ApiProperty({ example: 'Kasa 2' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'KASA2' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'code must be alphanumeric (dash/underscore allowed)',
  })
  code!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePosRegisterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'code must be alphanumeric (dash/underscore allowed)',
  })
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminPosSaleListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Sale number search' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-23' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  registerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Cashier user id' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Customer user id, or "retail" for walk-in',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: PosPaymentMethod })
  @IsOptional()
  @IsEnum(PosPaymentMethod)
  paymentMethod?: PosPaymentMethod;

  @ApiPropertyOptional({ enum: PosSaleStatus })
  @IsOptional()
  @IsEnum(PosSaleStatus)
  status?: PosSaleStatus;
}

export class PosLedgerLineDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  amount!: string;

  @ApiPropertyOptional({ nullable: true })
  debit!: string | null;

  @ApiPropertyOptional({ nullable: true })
  credit!: string | null;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  reference!: string;

  @ApiPropertyOptional({ nullable: true })
  referenceType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  referenceId!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class AdminPosSaleDetailDto extends PosSaleResponseDto {
  @ApiProperty({ type: [PosLedgerLineDto] })
  ledger!: PosLedgerLineDto[];
}

export class AdminPosSaleListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  saleNumber!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional({ nullable: true })
  completedAt!: string | null;

  @ApiProperty()
  registerId!: string;

  @ApiProperty()
  registerCode!: string;

  @ApiProperty()
  registerName!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  cashierName!: string;

  @ApiPropertyOptional({ nullable: true })
  customerId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  customerName!: string | null;

  @ApiProperty()
  grandTotal!: string;

  @ApiProperty({ enum: PosSaleStatus })
  status!: PosSaleStatus;

  @ApiProperty({ type: [String], description: 'Payment methods on this sale' })
  paymentMethods!: string[];
}
