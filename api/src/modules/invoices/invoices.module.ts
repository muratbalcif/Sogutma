import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminInvoicesController } from './admin-invoices.controller';
import { KolayBiClient } from './clients/kolaybi.client';
import { InvoiceDocumentService } from './invoice-document.service';
import { InvoiceFromSaleService } from './invoice-from-sale.service';
import { InvoiceFormalizeService } from './invoice-formalize.service';
import { InvoicesService } from './invoices.service';
import { INVOICE_PROVIDERS } from './providers/invoice-provider.interface';
import { KolayBiInvoiceProvider } from './providers/kolaybi.invoice-provider';

@Module({
  imports: [AdminModule, AuthModule, PrismaModule],
  controllers: [AdminInvoicesController],
  providers: [
    KolayBiClient,
    KolayBiInvoiceProvider,
    {
      provide: INVOICE_PROVIDERS,
      useFactory: (kolaybi: KolayBiInvoiceProvider) => [kolaybi],
      inject: [KolayBiInvoiceProvider],
    },
    InvoicesService,
    InvoiceFromSaleService,
    InvoiceFormalizeService,
    InvoiceDocumentService,
  ],
  exports: [
    InvoicesService,
    InvoiceFromSaleService,
    InvoiceFormalizeService,
    InvoiceDocumentService,
    KolayBiClient,
    KolayBiInvoiceProvider,
  ],
})
export class InvoicesModule {}
