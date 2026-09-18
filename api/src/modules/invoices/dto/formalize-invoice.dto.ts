import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceDocumentType, InvoiceStatus } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FormalizeInvoiceDto {
  @ApiPropertyOptional({
    description:
      'Optional KolayBi document number series prefix. When omitted, KolayBi uses the company default.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  prefix?: string;
}

export class FormalizeInvoiceResponseDto {
  @ApiProperty()
  invoiceId!: string;

  @ApiProperty()
  saleId!: string;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty({ enum: InvoiceDocumentType })
  documentType!: InvoiceDocumentType;

  @ApiProperty()
  provider!: string;

  @ApiPropertyOptional({ nullable: true })
  externalDocumentId!: string | null;

  @ApiProperty({ description: 'GİB ETTN (uuid) after formalize' })
  uuid!: string;

  @ApiPropertyOptional({ nullable: true })
  invoiceNumber!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Provider scenario from response (informational)',
  })
  providerScenario!: string | null;

  @ApiPropertyOptional({ nullable: true })
  errorCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  errorMessage!: string | null;

  @ApiProperty()
  alreadyFormalized!: boolean;
}
