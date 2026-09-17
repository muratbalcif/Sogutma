import { Module, forwardRef } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AdminPaymentsController } from './admin-payments.controller';
import { BankAccountsService } from './bank-accounts.service';
import { BankTransferService } from './bank-transfer.service';
import { EmailOutboxService } from './email-outbox.service';
import { PaymentExpirationService } from './payment-expiration.service';
import { PaymentStatusService } from './payment-status.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { DevelopmentPaymentProvider } from './providers/development.payment-provider';

@Module({
  imports: [
    AuthModule,
    AdminModule,
    AuditModule,
    InventoryModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => NotificationsModule),
  ],
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
    BankAccountsService,
    EmailOutboxService,
    PaymentExpirationService,
  ],
  exports: [
    PaymentsService,
    AccountingService,
    BankTransferService,
    BankAccountsService,
    EmailOutboxService,
  ],
})
export class PaymentsModule {}
