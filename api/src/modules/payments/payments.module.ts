import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AdminPaymentsController } from './admin-payments.controller';
import { BankTransferService } from './bank-transfer.service';
import { PaymentStatusService } from './payment-status.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { DevelopmentPaymentProvider } from './providers/development.payment-provider';

@Module({
  imports: [AuthModule, AdminModule, OrdersModule],
  controllers: [
    PaymentsController,
    AdminPaymentsController,
    AccountingController,
  ],
  providers: [
    DevelopmentPaymentProvider,
    PaymentStatusService,
    AccountingService,
    PaymentsService,
    BankTransferService,
  ],
  exports: [PaymentsService, AccountingService, BankTransferService],
})
export class PaymentsModule {}
