import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InvoiceDocumentType,
  InvoiceProviderCode,
  InvoiceStatus,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/** Presentation-only lifecycle (does not change InvoiceStatus enum). */
export type InvoiceDisplayStatus =
  'DRAFT' | 'FORMALIZED' | 'PENDING' | 'FAILED' | 'CANCELLED';

export class AdminInvoiceListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ enum: InvoiceProviderCode })
  @IsOptional()
  @IsEnum(InvoiceProviderCode)
  provider?: InvoiceProviderCode;

  @ApiPropertyOptional({ enum: InvoiceDocumentType })
  @IsOptional()
  @IsEnum(InvoiceDocumentType)
  documentType?: InvoiceDocumentType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  invoiceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalDocumentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  uuid?: string;

  @ApiPropertyOptional({
    description: 'Free text: invoice no, sale no, customer, uuid, external id',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-18' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description:
      'When status=SUCCESS: true = uuid present (formalized), false = draft',
  })
  @IsOptional()
  @IsString()
  formalized?: string;
}

export class InvoicePersonDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;
}

export class InvoiceListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  saleId!: string;

  @ApiProperty()
  saleNumber!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  customerLabel!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty({ enum: InvoiceDocumentType })
  documentType!: InvoiceDocumentType;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty({
    description: 'Presentation lifecycle derived from status + uuid',
  })
  displayStatus!: InvoiceDisplayStatus;

  @ApiPropertyOptional({ nullable: true })
  externalDocumentId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  invoiceNumber!: string | null;

  @ApiPropertyOptional({ nullable: true })
  uuid!: string | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  totalAmount!: string;

  @ApiPropertyOptional({ nullable: true })
  errorCode!: string | null;

  @ApiProperty()
  canFormalize!: boolean;

  @ApiProperty()
  canRetry!: boolean;

  @ApiProperty({
    description: 'PDF/XML download when formalized (uuid present)',
  })
  canDownloadPdf!: boolean;

  @ApiProperty({
    description: 'XML via KolayBi e-document/view?output_type=xml',
  })
  canDownloadXml!: boolean;

  @ApiProperty({
    description: 'Provider detail/list sync when externalDocumentId present',
  })
  canSync!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class InvoiceBillingSnapshotDto {
  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  city?: string;

  @ApiPropertyOptional()
  district?: string;

  @ApiPropertyOptional({ nullable: true })
  neighborhood?: string | null;

  @ApiPropertyOptional()
  addressLine?: string;

  @ApiPropertyOptional({ nullable: true })
  postalCode?: string | null;

  @ApiPropertyOptional()
  country?: string;

  @ApiPropertyOptional({ nullable: true })
  companyName?: string | null;
}

export class InvoiceDetailDto extends InvoiceListItemDto {
  @ApiProperty()
  subtotal!: string;

  @ApiProperty()
  discountAmount!: string;

  @ApiProperty()
  taxAmount!: string;

  @ApiPropertyOptional({ nullable: true })
  errorMessage!: string | null;

  @ApiPropertyOptional({ nullable: true })
  billingAddressId!: string | null;

  @ApiProperty({ type: InvoiceBillingSnapshotDto })
  billingAddressSnapshot!: InvoiceBillingSnapshotDto;

  @ApiProperty({ type: InvoicePersonDto })
  createdBy!: InvoicePersonDto;

  @ApiPropertyOptional({ type: InvoicePersonDto, nullable: true })
  customer!: InvoicePersonDto | null;

  @ApiPropertyOptional({ nullable: true })
  issuedAt!: Date | null;
}

/** Shared action-flag helpers for list/detail. */

/**
 * Retry policy (Phase 9):
 * - Create retry (FAILED invoice, from-sale): timeout / rate / upstream / network / invalid response
 * - Formalize retry (draft + FORMALIZE_UNKNOWN or same create-like codes while canFormalize): FORMALIZE_UNKNOWN + shared transport codes
 * - Document download / sync: use KolayBiApiError.retryable on the HTTP call — NOT canRetry UI flag
 * - VALIDATION / NOT_FOUND / CONFLICT / TOTAL_MISMATCH are NEVER retryable via canRetry
 */
export const RETRYABLE_CREATE_ERROR_CODES = new Set([
  'KOLAYBI_TIMEOUT',
  'KOLAYBI_RATE_LIMITED',
  'KOLAYBI_UPSTREAM_ERROR',
  'KOLAYBI_NETWORK_ERROR',
  'KOLAYBI_INVALID_RESPONSE',
]);

export const RETRYABLE_FORMALIZE_ERROR_CODES = new Set([
  'FORMALIZE_UNKNOWN',
  ...RETRYABLE_CREATE_ERROR_CODES,
]);

/** @deprecated Use RETRYABLE_CREATE / FORMALIZE sets; kept as union for canRetry */
export const RETRYABLE_INVOICE_ERROR_CODES = new Set([
  ...RETRYABLE_FORMALIZE_ERROR_CODES,
]);

export function resolveInvoiceDisplayStatus(
  status: InvoiceStatus,
  uuid: string | null,
): InvoiceDisplayStatus {
  if (status === InvoiceStatus.PENDING) return 'PENDING';
  if (status === InvoiceStatus.FAILED) return 'FAILED';
  if (status === InvoiceStatus.CANCELLED) return 'CANCELLED';
  if (status === InvoiceStatus.SUCCESS) {
    return uuid?.trim() ? 'FORMALIZED' : 'DRAFT';
  }
  return 'PENDING';
}

export function resolveCanFormalize(input: {
  status: InvoiceStatus;
  uuid: string | null;
  externalDocumentId: string | null;
}): boolean {
  return (
    input.status === InvoiceStatus.SUCCESS &&
    !input.uuid?.trim() &&
    Boolean(input.externalDocumentId?.trim())
  );
}

export function resolveCanRetry(input: {
  status: InvoiceStatus;
  uuid: string | null;
  externalDocumentId: string | null;
  errorCode: string | null;
}): boolean {
  if (!input.errorCode) {
    return false;
  }
  // Formalize retry: draft still present + formalize-retryable code
  if (
    resolveCanFormalize(input) &&
    RETRYABLE_FORMALIZE_ERROR_CODES.has(input.errorCode)
  ) {
    return true;
  }
  // Create retry: FAILED row only with create-retryable codes (not validation)
  return (
    input.status === InvoiceStatus.FAILED &&
    RETRYABLE_CREATE_ERROR_CODES.has(input.errorCode)
  );
}

export function resolveCanDownloadDocument(input: {
  status: InvoiceStatus;
  uuid: string | null;
}): boolean {
  return input.status === InvoiceStatus.SUCCESS && Boolean(input.uuid?.trim());
}

export function resolveCanSync(input: {
  externalDocumentId: string | null;
}): boolean {
  return Boolean(input.externalDocumentId?.trim());
}
