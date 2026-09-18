import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import {
  resolveInvoiceDisplayStatus,
  type InvoiceDisplayStatus,
} from './invoice-query.dto';

export class InvoiceSyncResponseDto {
  @ApiProperty()
  invoiceId!: string;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty({
    description: 'Presentation lifecycle derived from status + uuid',
    example: 'FORMALIZED',
  })
  displayStatus!: InvoiceDisplayStatus;

  @ApiPropertyOptional({ nullable: true })
  uuid!: string | null;

  @ApiPropertyOptional({ nullable: true })
  invoiceNumber!: string | null;

  @ApiPropertyOptional({ nullable: true })
  externalDocumentId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Ephemeral KolayBi e_document_status from list — not a local enum',
  })
  providerEDocumentStatus!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Ephemeral KolayBi commercial_doc_status — not persisted (no migration)',
  })
  providerCommercialStatus!: string | null;

  @ApiProperty({ description: 'Whether local uuid/invoiceNumber changed' })
  updated!: boolean;
}

export function toSyncDisplayStatus(
  status: InvoiceStatus,
  uuid: string | null,
): InvoiceDisplayStatus {
  return resolveInvoiceDisplayStatus(status, uuid);
}
