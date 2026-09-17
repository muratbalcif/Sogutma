import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AdminRoleCode,
  InventoryTransactionType,
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
import { OrdersService } from '../src/modules/orders/orders.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

type OrderBody = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: string;
  items: Array<{
    productName: string;
    sku: string;
    unitPrice: string;
    quantity: number;
  }>;
  shippingAddress: { title: string; city: string };
  statusHistory: Array<{ toStatus: OrderStatus }>;
  payment: { status: string } | null;
};

describe('Orders & Checkout (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;
  let adminService: AdminService;
  let ordersService: OrdersService;
  let userAToken: string;
  let userBToken: string;
  let adminToken: string;
  let userAId: string;
  let userBId: string;
  let productId: string;
  let addressAId: string;
  let addressBId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    adminService = app.get(AdminService);
    ordersService = app.get(OrdersService);

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

    const userA = await authService.register({
      email: `order.a.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Order',
      lastName: 'Alpha',
      userType: UserType.INDIVIDUAL,
    });
    userAToken = userA.accessToken;
    userAId = userA.user.id;

    const userB = await authService.register({
      email: `order.b.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Order',
      lastName: 'Beta',
      userType: UserType.INDIVIDUAL,
    });
    userBToken = userB.accessToken;
    userBId = userB.user.id;

    const adminAuth = await authService.register({
      email: `order.admin.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Order',
      lastName: 'Admin',
      userType: UserType.INDIVIDUAL,
    });
    await adminService.assignRoleToUser(
      adminAuth.user.id,
      AdminRoleCode.SUPER_ADMIN,
    );
    adminToken = (
      await authService.login({
        email: `order.admin.${suffix}@example.com`,
        password: 'Password123!',
      })
    ).accessToken;

    const brand = await prisma.brand.create({
      data: { name: `Brand Ord ${suffix}`, slug: `brand-ord-${suffix}` },
    });
    const category = await prisma.category.create({
      data: {
        name: `Category Ord ${suffix}`,
        slug: `category-ord-${suffix}`,
      },
    });
    const product = await prisma.product.create({
      data: {
        sku: `ORD-${suffix}`,
        name: 'Klima Motoru',
        slug: `order-product-${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        vatRate: 20,
        inventory: {
          create: {
            quantity: 5,
            reservedQuantity: 0,
            minimumQuantity: 0,
          },
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

    const addressA = await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Ev',
        firstName: 'Order',
        lastName: 'Alpha',
        phone: '+905551110001',
        city: 'Mersin',
        district: 'Yenisehir',
        addressLine: 'Ataturk Cad. 1',
        country: 'TR',
      })
      .expect(201);
    addressAId = (addressA.body as { id: string }).id;

    const addressB = await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        title: 'Is',
        firstName: 'Order',
        lastName: 'Beta',
        phone: '+905551110002',
        city: 'Adana',
        district: 'Seyhan',
        addressLine: 'Inonu Cad. 2',
        country: 'TR',
      })
      .expect(201);
    addressBId = (addressB.body as { id: string }).id;
  });

  afterAll(async () => {
    await prisma.inventoryTransaction.deleteMany({
      where: { productId },
    });
    await prisma.accountTransaction.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.payment.deleteMany({
      where: { order: { userId: { in: [userAId, userBId] } } },
    });
    await prisma.orderStatusHistory.deleteMany({
      where: { order: { userId: { in: [userAId, userBId] } } },
    });
    await prisma.orderItem.deleteMany({
      where: { order: { userId: { in: [userAId, userBId] } } },
    });
    await prisma.order.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.cartItem.deleteMany({
      where: { cart: { userId: { in: [userAId, userBId] } } },
    });
    await prisma.cart.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.address.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    if (productId) {
      await prisma.productPrice.deleteMany({ where: { productId } });
      await prisma.inventory.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    await prisma.brand.deleteMany({ where: { slug: `brand-ord-${suffix}` } });
    await prisma.category.deleteMany({
      where: { slug: `category-ord-${suffix}` },
    });
    await prisma.refreshToken.deleteMany({
      where: {
        user: {
          email: {
            in: [
              `order.a.${suffix}@example.com`,
              `order.b.${suffix}@example.com`,
              `order.admin.${suffix}@example.com`,
            ],
          },
        },
      },
    });
    await prisma.adminUserRole.deleteMany({
      where: {
        adminUser: {
          user: { email: `order.admin.${suffix}@example.com` },
        },
      },
    });
    await prisma.adminUser.deleteMany({
      where: { user: { email: `order.admin.${suffix}@example.com` } },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            `order.a.${suffix}@example.com`,
            `order.b.${suffix}@example.com`,
            `order.admin.${suffix}@example.com`,
          ],
        },
      },
    });
    await app.close();
  });

  async function addToCart(token: string, quantity: number): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity })
      .expect(201);
  }

  it('rejects empty cart checkout and order creation', async () => {
    const validation = await request(app.getHttpServer())
      .post('/api/v1/checkout/validate')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        shippingAddressId: addressAId,
        billingAddressId: addressAId,
      })
      .expect(200);
    expect((validation.body as { valid: boolean }).valid).toBe(false);

    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        shippingAddressId: addressAId,
        billingAddressId: addressAId,
      })
      .expect(409);
  });

  it('rejects client-supplied price fields on order create', async () => {
    await addToCart(userAToken, 1);
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        shippingAddressId: addressAId,
        billingAddressId: addressAId,
        unitPrice: '1.00',
        totalAmount: '1.00',
      })
      .expect(400);
    await request(app.getHttpServer())
      .delete('/api/v1/cart')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
  });

  it('validates checkout, creates order, clears cart, reserves stock', async () => {
    await addToCart(userAToken, 2);

    const validation = await request(app.getHttpServer())
      .post('/api/v1/checkout/validate')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        shippingAddressId: addressAId,
        billingAddressId: addressAId,
      })
      .expect(200);

    const validationBody = validation.body as {
      valid: boolean;
      summary: { total: string; tax: string };
    };
    expect(validationBody.valid).toBe(true);
    expect(validationBody.summary.total).toBe('2000.00');

    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        shippingAddressId: addressAId,
        billingAddressId: addressAId,
        customerNote: 'Kapıya bırakın',
      })
      .expect(201);

    const order = created.body as OrderBody;
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.orderNumber).toMatch(/^FS-\d{8}-\d{6}$/);
    expect(order.items[0].unitPrice).toBe('1000.00');
    expect(order.items[0].productName).toBe('Klima Motoru');
    expect(order.items[0].sku).toBe(`ORD-${suffix}`);
    expect(order.shippingAddress.city).toBe('Mersin');
    expect(order.statusHistory[0].toStatus).toBe(OrderStatus.PENDING);
    expect(order.payment).toBeNull();

    const cart = await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    expect((cart.body as { items: unknown[] }).items).toHaveLength(0);

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productId },
    });
    expect(inventory.reservedQuantity).toBe(2);

    const reservation = await prisma.inventoryTransaction.findFirst({
      where: {
        productId,
        type: InventoryTransactionType.RESERVATION,
        referenceType: 'ORDER',
        referenceId: order.id,
      },
    });
    expect(reservation).not.toBeNull();

    await prisma.productPrice.updateMany({
      where: { productId },
      data: { price: '1500.00' },
    });
    await prisma.product.update({
      where: { id: productId },
      data: { name: 'Updated Name', sku: `CHANGED-${suffix}` },
    });
    await prisma.address.update({
      where: { id: addressAId },
      data: { title: 'Changed', city: 'Ankara' },
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    const detailBody = detail.body as OrderBody;
    expect(detailBody.items[0].unitPrice).toBe('1000.00');
    expect(detailBody.items[0].productName).toBe('Klima Motoru');
    expect(detailBody.items[0].sku).toBe(`ORD-${suffix}`);
    expect(detailBody.shippingAddress.title).toBe('Ev');
    expect(detailBody.shippingAddress.city).toBe('Mersin');

    await prisma.product.update({
      where: { id: productId },
      data: { name: 'Klima Motoru', sku: `ORD-${suffix}` },
    });
    await prisma.productPrice.updateMany({
      where: { productId },
      data: { price: '1000.00' },
    });
    await prisma.address.update({
      where: { id: addressAId },
      data: { title: 'Ev', city: 'Mersin' },
    });

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(201);
    expect((cancelled.body as OrderBody).status).toBe(OrderStatus.CANCELLED);

    const inventoryAfter = await prisma.inventory.findUniqueOrThrow({
      where: { productId },
    });
    expect(inventoryAfter.reservedQuantity).toBe(0);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(409);
  });

  it('isolates orders and addresses between users', async () => {
    await addToCart(userAToken, 1);
    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        shippingAddressId: addressAId,
        billingAddressId: addressAId,
      })
      .expect(201);
    const orderId = (created.body as OrderBody).id;

    await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(403);

    const listB = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);
    expect((listB.body as { items: unknown[] }).items).toHaveLength(0);

    await request(app.getHttpServer())
      .post('/api/v1/checkout/validate')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        shippingAddressId: addressAId,
        billingAddressId: addressAId,
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(201);
  });

  it('prevents oversell under concurrent checkout', async () => {
    await prisma.inventory.update({
      where: { productId },
      data: { quantity: 5, reservedQuantity: 0 },
    });

    await addToCart(userAToken, 4);
    await addToCart(userBToken, 4);

    const results = await Promise.allSettled([
      ordersService.create(userAId, UserType.INDIVIDUAL, {
        shippingAddressId: addressAId,
        billingAddressId: addressAId,
      }),
      ordersService.create(userBId, UserType.INDIVIDUAL, {
        shippingAddressId: addressBId,
        billingAddressId: addressBId,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productId },
    });
    expect(inventory.reservedQuantity).toBe(4);
    expect(
      inventory.quantity - inventory.reservedQuantity,
    ).toBeGreaterThanOrEqual(0);
    expect(inventory.reservedQuantity).toBeLessThanOrEqual(5);

    const winner = (fulfilled[0] as PromiseFulfilledResult<{ id: string }>)
      .value;
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: winner.id },
    });
    const token = order.userId === userAId ? userAToken : userBToken;
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${winner.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    await request(app.getHttpServer())
      .delete('/api/v1/cart')
      .set('Authorization', `Bearer ${userAToken}`);
    await request(app.getHttpServer())
      .delete('/api/v1/cart')
      .set('Authorization', `Bearer ${userBToken}`);
  });

  it('supports admin order list and status updates with RBAC', async () => {
    await prisma.inventory.update({
      where: { productId },
      data: { quantity: 10, reservedQuantity: 0 },
    });
    await addToCart(userAToken, 1);
    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        shippingAddressId: addressAId,
        billingAddressId: addressAId,
      })
      .expect(201);
    const orderId = (created.body as OrderBody).id;

    await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(403);

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (list.body as { items: OrderBody[] }).items.some((o) => o.id === orderId),
    ).toBe(true);

    const confirmed = await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.CONFIRMED, note: 'Sipariş onaylandı' })
      .expect(200);
    expect((confirmed.body as OrderBody).status).toBe(OrderStatus.CONFIRMED);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.DELIVERED })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(201);
  });
});
