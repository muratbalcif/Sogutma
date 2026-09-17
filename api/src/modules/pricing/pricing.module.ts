import { Module, forwardRef } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AdminPricingController } from './admin-pricing.controller';
import { PriceService } from './pricing.service';

@Module({
  imports: [AdminModule, AuthModule, forwardRef(() => CampaignsModule)],
  controllers: [AdminPricingController],
  providers: [PriceService],
  exports: [PriceService],
})
export class PricingModule {}
