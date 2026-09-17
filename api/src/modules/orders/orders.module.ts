import { Module, forwardRef } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { CouponsModule } from '../coupons/coupons.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PricingModule } from '../pricing/pricing.module';
import { ShippingModule } from '../shipping/shipping.module';
import { AdminOrdersController } from './admin-orders.controller';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { OrderStatusService } from './order-status.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    AuthModule,
    AdminModule,
    AddressesModule,
    PricingModule,
    CouponsModule,
    InventoryModule,
    ShippingModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [CheckoutController, OrdersController, AdminOrdersController],
  providers: [CheckoutService, OrdersService, OrderStatusService],
  exports: [OrdersService, CheckoutService, OrderStatusService],
})
export class OrdersModule {}
