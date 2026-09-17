import { Module } from '@nestjs/common';
import { ManualShippingProvider } from './manual-shipping.provider';
import { SHIPPING_PROVIDERS } from './shipping-provider.interface';
import { ShippingService } from './shipping.service';

@Module({
  providers: [
    ManualShippingProvider,
    {
      provide: SHIPPING_PROVIDERS,
      useFactory: (manual: ManualShippingProvider) => [manual],
      inject: [ManualShippingProvider],
    },
    ShippingService,
  ],
  exports: [ShippingService, ManualShippingProvider],
})
export class ShippingModule {}
