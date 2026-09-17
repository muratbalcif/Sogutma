import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductAlertsController } from './product-alerts.controller';
import { ProductAlertService } from './product-alert.service';

@Module({
  imports: [AuthModule],
  controllers: [ProductAlertsController],
  providers: [ProductAlertService],
  exports: [ProductAlertService],
})
export class ProductAlertsModule {}
