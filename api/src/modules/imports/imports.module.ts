import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AdminImportsController } from './admin-imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [AuthModule, AdminModule, InventoryModule, AuditModule],
  controllers: [AdminImportsController],
  providers: [ImportsService],
  exports: [ImportsService],
})
export class ImportsModule {}
