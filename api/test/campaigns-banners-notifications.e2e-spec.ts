import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AdminRoleCode,
  CampaignType,
  DevicePlatform,
  OrderStatus,
  PriceType,
  UserType,
} from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { AdminService } from '../src/modules/admin/admin.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('Campaigns, Banners & Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;
  let adminService: AdminService;
  let inventoryService: InventoryService;
  let userToken: string;
  let adminToken: string;
  let userId: string;
  let productId: string;
  let productSlug: string;
  let addressId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    adminService = app.get(AdminService);
    inventoryService = app.get(InventoryService);

    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await adminService.ensureRbacCatalog();

    const user = await authService.register({
      email: `camp.user.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Camp',
      lastName: 'User',
      userType: UserType.INDIVIDUAL,
    });
    userToken = user.accessToken;
    userId = user.user.id;

    const adminAuth = await authService.register({
      email: `camp.admin.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Camp',
      lastName: 'Admin',
      userType: UserType.INDIVIDUAL,
    });
    await adminService.assignRoleToUser(
      adminAuth.user.id,
      AdminRoleCode.SUPER_ADMIN,
    );
    adminToken = (
      await authService.login({
        email: `camp.admin.${suffix}@example.com`,
        password: 'Password123!',
      })
    ).accessToken;

    const brand = await prisma.brand.create({
      data: { name: `Brand Camp ${suffix}`, slug: `brand-camp-${suffix}` },
    });
    const category = await prisma.category.create({
      data: {
        name: `Category Camp ${suffix}`,
        slug: `category-camp-${suffix}`,
      },
    });
    const product = await prisma.product.create({
      data: {
        sku: `CAMP-${suffix}`,
        name: `Campaign Product ${suffix}`,
        slug: `campaign-product-${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        vatRate: 20,
        inventory: {
          create: { quantity: 0, reservedQuantity: 0, minimumQuantity: 0 },
        },
        prices: {
          create: {
            type: PriceType.RETAIL,
            price: '1000.00',
            currency: 'TRY',
            active: true,
          },
        },
      },
    });
    productId = product.id;
    productSlug = product.slug;

    const address = await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Ev',
        firstName: 'Camp',
        lastName: 'User',
        phone: '+905551110088',
        city: 'Mersin',
        district: 'Yenisehir',
        addressLine: 'Cadde 8',
        country: 'TR',
      })
      .expect(201);
    addressId = (address.body as { id: string }).id;
  });

  afterAll(async () => {
    await prisma.notificationOutbox.deleteMany({});
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.deviceToken.deleteMany({ where: { userId } });
    await prisma.notificationPreference.deleteMany({ where: { userId } });
    await prisma.campaignProduct.deleteMany({ where: { productId } });
    await prisma.campaign.deleteMany({
      where: { slug: { contains: `camp-${suffix}` } },
    });
    await prisma.banner.deleteMany({
      where: { title: { contains: `Banner ${suffix}` } },
    });
    await prisma.productAlert.deleteMany({ where: { userId } });
    await prisma.accountTransaction.deleteMany({ where: { userId } });
    await prisma.payment.deleteMany({ where: { order: { userId } } });
    await prisma.orderStatusHistory.deleteMany({
      where: { order: { userId } },
    });
    await prisma.orderItem.deleteMany({ where: { order: { userId } } });
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    await prisma.cart.deleteMany({ where: { userId } });
    await prisma.address.deleteMany({ where: { userId } });
    if (productId) {
      await prisma.inventoryTransaction.deleteMany({ where: { productId } });
      await prisma.productPrice.deleteMany({ where: { productId } });
      await prisma.inventory.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    await prisma.brand.deleteMany({ where: { slug: `brand-camp-${suffix}` } });
    await prisma.category.deleteMany({
      where: { slug: `category-camp-${suffix}` },
    });
    await prisma.refreshToken.deleteMany({
      where: {
        user: {
          email: {
            in: [
              `camp.user.${suffix}@example.com`,
              `camp.admin.${suffix}@example.com`,
            ],
          },
        },
      },
    });
    await prisma.adminUserRole.deleteMany({
      where: {
        adminUser: { user: { email: `camp.admin.${suffix}@example.com` } },
      },
    });
    await prisma.adminUser.deleteMany({
      where: { user: { email: `camp.admin.${suffix}@example.com` } },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            `camp.user.${suffix}@example.com`,
            `camp.admin.${suffix}@example.com`,
          ],
        },
      },
    });
    await app.close();
  });

  it('creates campaign and reflects price in product resolution', async () => {
    const startsAt = new Date(Date.now() - 60_000).toISOString();
    const endsAt = new Date(Date.now() + 86_400_000).toISOString();

    const campaign = await request(app.getHttpServer())
      .post('/api/v1/admin/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Summer ${suffix}`,
        slug: `summer-camp-${suffix}`,
        type: CampaignType.PERCENTAGE,
        startsAt,
        endsAt,
        priority: 10,
      })
      .expect(201);

    const campaignId = (campaign.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/campaigns/${campaignId}/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId, discountPercentage: '10.00' })
      .expect(201);

    const publicList = await request(app.getHttpServer())
      .get('/api/v1/campaigns')
      .expect(200);
    expect(
      (publicList.body as Array<{ slug: string }>).some(
        (c) => c.slug === `summer-camp-${suffix}`,
      ),
    ).toBe(true);

    const product = await request(app.getHttpServer())
      .get(`/api/v1/products/${productSlug}`)
      .expect(200);
    expect((product.body as { price: { amount: string } }).price.amount).toBe(
      '900.00',
    );
  });

  it('manages banners and lists active ones', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/banners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Banner ${suffix}`,
        imageUrl: 'https://cdn.example.com/banner.jpg',
        sortOrder: 1,
        active: true,
      })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/v1/banners')
      .expect(200);
    expect(
      (list.body as Array<{ title: string }>).some(
        (b) => b.title === `Banner ${suffix}`,
      ),
    ).toBe(true);
  });

  it('registers devices, notifies on stock and order status', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/notifications/devices')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        token: `android-token-${suffix}-abcdefghij`,
        platform: DevicePlatform.ANDROID,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/alerts`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(201);

    await inventoryService.increaseStock(productId, 10, { note: 'restock' });
    await inventoryService.increaseStock(productId, 5, { note: 'again' });

    const stockNotifications = await prisma.notification.count({
      where: {
        userId,
        type: 'STOCK_AVAILABLE',
      },
    });
    expect(stockNotifications).toBe(1);

    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    const order = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        shippingAddressId: addressId,
        billingAddressId: addressId,
      })
      .expect(201);
    const orderId = (order.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.CONFIRMED })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.PREPARING })
      .expect(200);

    // SHIPPED requires dedicated ship endpoint with tracking — covered elsewhere.
    const list = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(
      (list.body as { items: unknown[] }).items.length,
    ).toBeGreaterThanOrEqual(2);

    const unread = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect((unread.body as { count: number }).count).toBeGreaterThan(0);

    const firstId = (list.body as { items: Array<{ id: string }> }).items[0].id;
    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${firstId}/read`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
  });
});
