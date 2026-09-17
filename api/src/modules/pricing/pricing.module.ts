import { Module, forwardRef } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AdminPricingController } from './admin-pricing.controller';
import { PriceService } from './pricing.service';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    AuditModule,
    forwardRef(() => CampaignsModule),
  ],
  controllers: [AdminPricingController],
  providers: [PriceService],
  exports: [PriceService],
})
export class PricingModule {}
