import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { PricingModule } from '../pricing/pricing.module';
import { AdminPosPhase5Controller } from './admin-pos-phase5.controller';
import { AdminPosRegistersController } from './admin-pos-registers.controller';
import { AdminPosSalesController } from './admin-pos-sales.controller';
import { PosAdminService } from './pos-admin.service';
import { PosController } from './pos.controller';
import { PosReportsService } from './pos-reports.service';
import { PosReturnService } from './pos-return.service';
import { PosService } from './pos.service';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    AuditModule,
    InventoryModule,
    PricingModule,
    PaymentsModule,
  ],
  controllers: [
    PosController,
    AdminPosRegistersController,
    AdminPosSalesController,
    AdminPosPhase5Controller,
  ],
  providers: [PosService, PosAdminService, PosReturnService, PosReportsService],
  exports: [PosService, PosAdminService, PosReturnService, PosReportsService],
})
export class PosModule {}
