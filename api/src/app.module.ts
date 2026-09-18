import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AdminModule } from './modules/admin/admin.module';
import { AdminRbacModule } from './modules/admin/admin-rbac.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BannersModule } from './modules/banners/banners.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { CartModule } from './modules/cart/cart.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { AdminCustomersModule } from './modules/customers/admin-customers.module';
import { CustomersModule } from './modules/customers/customers.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { HealthModule } from './modules/health/health.module';
import { ImportsModule } from './modules/imports/imports.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ProductAlertsModule } from './modules/product-alerts/product-alerts.module';
import { ProductsModule } from './modules/products/products.module';
import { RedisModule } from './modules/redis/redis.module';
import { RedisThrottlerStorage } from './modules/redis/redis-throttler.storage';
import { SalesModule } from './modules/sales/sales.module';
import { SiteModule } from './modules/site/site.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';
import { EnvironmentVariables } from './config/env.validation';

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
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [ConfigService, RedisThrottlerStorage],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
        storage: RedisThrottlerStorage,
      ) => {
        const isProd = config.get('NODE_ENV', { infer: true }) === 'production';
        return {
          throttlers: [
            {
              name: 'default',
              ttl: config.get('THROTTLE_TTL_MS', { infer: true }) ?? 60_000,
              limit:
                config.get('THROTTLE_LIMIT', { infer: true }) ??
                (isProd ? 120 : 300),
            },
          ],
          storage,
        };
      },
    }),
    PrismaModule,
    UsersModule,
    CustomersModule,
    AdminCustomersModule,
    AdminModule,
    AdminRbacModule,
    AuthModule,
    AuditModule,
    StorageModule,
    CategoriesModule,
    BrandsModule,
    InventoryModule,
    CampaignsModule,
    PricingModule,
    CouponsModule,
    ProductsModule,
    ImportsModule,
    CartModule,
    FavoritesModule,
    ProductAlertsModule,
    AddressesModule,
    OrdersModule,
    SalesModule,
    InvoicesModule,
    PaymentsModule,
    BannersModule,
    NotificationsModule,
    SiteModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
