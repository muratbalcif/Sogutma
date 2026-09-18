import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceDocumentType, InvoiceStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateInvoiceFromSaleDto {
  @ApiPropertyOptional({
    enum: InvoiceDocumentType,
    description:
      'Optional. When omitted, derived from User.isEInvoiceTaxpayer (true → E_INVOICE, else E_ARCHIVE). Phase 5 does not formalize to GİB.',
  })
  @IsOptional()
  @IsEnum(InvoiceDocumentType)
  documentType?: InvoiceDocumentType;

  @ApiPropertyOptional({
    description:
      'Billing address id belonging to the sale customer. When omitted, default address is used if unambiguous.',
  })
  @IsOptional()
  @IsUUID()
  billingAddressId?: string;
}

export class InvoiceFromSaleResponseDto {
  @ApiProperty()
  invoiceId!: string;

  @ApiProperty()
  saleId!: string;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty()
  provider!: string;

  @ApiProperty({ enum: InvoiceDocumentType })
  documentType!: InvoiceDocumentType;

  @ApiPropertyOptional({ nullable: true })
  externalDocumentId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  invoiceNumber!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'GİB ETTN — typically null until Phase 6 formalize',
  })
  uuid!: string | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  subtotal!: string;

  @ApiProperty()
  taxAmount!: string;

  @ApiProperty()
  totalAmount!: string;

  @ApiPropertyOptional({ nullable: true })
  errorCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  errorMessage!: string | null;
}
