import { Module, forwardRef } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { CustomersModule } from './customers.module';

/**
 * Separate from CustomersModule to avoid Auth ↔ Customers ↔ Payments cycles.
 * CustomersModule stays lean for Auth registration/corporate profile.
 */
@Module({
  imports: [
    CustomersModule,
    AdminModule,
    AuthModule,
    AuditModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [AdminCustomersController],
  providers: [AdminCustomersService],
  exports: [AdminCustomersService],
})
export class AdminCustomersModule {}
