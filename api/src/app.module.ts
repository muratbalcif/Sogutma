import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BannersModule } from './modules/banners/banners.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { CartModule } from './modules/cart/cart.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CustomersModule } from './modules/customers/customers.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ProductAlertsModule } from './modules/product-alerts/product-alerts.module';
import { ProductsModule } from './modules/products/products.module';
import { SiteModule } from './modules/site/site.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    PrismaModule,
    UsersModule,
    CustomersModule,
    AdminModule,
    AuthModule,
    CategoriesModule,
    BrandsModule,
    InventoryModule,
    CampaignsModule,
    PricingModule,
    ProductsModule,
    CartModule,
    FavoritesModule,
    ProductAlertsModule,
    AddressesModule,
    OrdersModule,
    PaymentsModule,
    BannersModule,
    NotificationsModule,
    SiteModule,
    HealthModule,
  ],
})
export class AppModule {}
