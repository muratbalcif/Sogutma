import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingModule } from '../pricing/pricing.module';
import { AdminSalesController } from './admin-sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    AuditModule,
    InventoryModule,
    PricingModule,
  ],
  controllers: [AdminSalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
