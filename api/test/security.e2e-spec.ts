import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminRoleCode, PriceType, UserType } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { AdminService } from '../src/modules/admin/admin.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { flushTestRedis } from './flush-redis';

/**
 * Production verification: request-id, rate limit, RBAC, IDOR, payment DTO hardening.
 */
describe('Security hardening (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;
  let adminService: AdminService;
  const suffix = Date.now();

  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let productManagerToken: string;
  let accountingToken: string;
  let orderAId: string;
  let addressAId: string;

  beforeAll(async () => {
    await flushTestRedis();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    adminService = app.get(AdminService);

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
      email: `sec.a.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Sec',
      lastName: 'A',
      userType: UserType.INDIVIDUAL,
    });
    userAToken = userA.accessToken;
    userAId = userA.user.id;

    const userB = await authService.register({
      email: `sec.b.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Sec',
      lastName: 'B',
      userType: UserType.INDIVIDUAL,
    });
    userBToken = userB.accessToken;

    const pm = await authService.register({
      email: `sec.pm.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'PM',
      lastName: 'Admin',
      userType: UserType.INDIVIDUAL,
    });
    await adminService.assignRoleToUser(
      pm.user.id,
      AdminRoleCode.PRODUCT_MANAGER,
    );
    productManagerToken = (
      await authService.login({
        email: `sec.pm.${suffix}@example.com`,
        password: 'Password123!',
      })
    ).accessToken;

    const acc = await authService.register({
      email: `sec.acc.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Acc',
      lastName: 'Admin',
      userType: UserType.INDIVIDUAL,
    });
    await adminService.assignRoleToUser(acc.user.id, AdminRoleCode.ACCOUNTING);
    accountingToken = (
      await authService.login({
        email: `sec.acc.${suffix}@example.com`,
        password: 'Password123!',
      })
    ).accessToken;

    const brand = await prisma.brand.create({
      data: { name: `Brand Sec ${suffix}`, slug: `brand-sec-${suffix}` },
    });
    const category = await prisma.category.create({
      data: {
        name: `Category Sec ${suffix}`,
        slug: `category-sec-${suffix}`,
      },
    });
    const product = await prisma.product.create({
      data: {
        sku: `SEC-${suffix}`,
        name: `Security Product ${suffix}`,
        slug: `security-product-${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        vatRate: 20,
        inventory: {
          create: { quantity: 50, reservedQuantity: 0, minimumQuantity: 0 },
        },
        prices: {
          create: {
            type: PriceType.RETAIL,
            price: '250.00',
            currency: 'TRY',
            active: true,
          },
        },
      },
    });

    const address = await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Ev',
        firstName: 'Sec',
        lastName: 'A',
        phone: '+905551112233',
        city: 'Mersin',
        district: 'Yenisehir',
        addressLine: 'Cadde 1',
        country: 'TR',
      })
      .expect(201);
    addressAId = (address.body as { id: string }).id;

    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ productId: product.id, quantity: 1 })
      .expect(201);

    const order = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        shippingAddressId: addressAId,
        billingAddressId: addressAId,
      })
      .expect(201);
    orderAId = (order.body as { id: string }).id;
  }, 120_000);

  afterAll(async () => {
    if (!app) return;
    try {
      const product = await prisma.product.findFirst({
        where: { sku: `SEC-${suffix}` },
        select: { id: true },
      });
      await prisma.accountTransaction.deleteMany({
        where: { user: { email: { contains: `sec.` } } },
      });
      await prisma.payment.deleteMany({
        where: { order: { user: { email: { contains: `sec.` } } } },
      });
      await prisma.orderItem.deleteMany({
        where: { order: { user: { email: { contains: `sec.` } } } },
      });
      await prisma.orderStatusHistory.deleteMany({
        where: { order: { user: { email: { contains: `sec.` } } } },
      });
      await prisma.order.deleteMany({
        where: { user: { email: { contains: `sec.` } } },
      });
      await prisma.cartItem.deleteMany({
        where: { cart: { user: { email: { contains: `sec.` } } } },
      });
      await prisma.cart.deleteMany({
        where: { user: { email: { contains: `sec.` } } },
      });
      await prisma.address.deleteMany({
        where: { user: { email: { contains: `sec.` } } },
      });
      if (product) {
        await prisma.inventoryTransaction.deleteMany({
          where: { productId: product.id },
        });
        await prisma.productPrice.deleteMany({
          where: { productId: product.id },
        });
        await prisma.inventory.deleteMany({ where: { productId: product.id } });
        await prisma.product.deleteMany({ where: { id: product.id } });
      }
      await prisma.brand.deleteMany({ where: { slug: `brand-sec-${suffix}` } });
      await prisma.category.deleteMany({
        where: { slug: `category-sec-${suffix}` },
      });
      await prisma.refreshToken.deleteMany({
        where: { user: { email: { contains: `sec.` } } },
      });
      await prisma.adminUserRole.deleteMany({
        where: { adminUser: { user: { email: { contains: `sec.` } } } },
      });
      await prisma.adminUser.deleteMany({
        where: { user: { email: { contains: `sec.` } } },
      });
      await prisma.user.deleteMany({ where: { email: { contains: `sec.` } } });
    } finally {
      await flushTestRedis();
      await app.close();
    }
  });

  it('returns X-Request-Id on responses', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);
    expect(res.headers['x-request-id']).toMatch(/^[a-zA-Z0-9\-_]{8,64}$/);
  });

  it('echoes valid client X-Request-Id', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('X-Request-Id', 'client-req-id-12345678')
      .expect(200);
    expect(res.headers['x-request-id']).toBe('client-req-id-12345678');
  });

  it('health live is up while ready reports dependency checks', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    const ready = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);
    expect(ready.body).toMatchObject({
      checks: { database: 'up', redis: 'up' },
    });
  });

  it('rejects unknown paymentStatus from client (whitelist)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderAId}/payment`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ method: 'BANK_TRANSFER', paymentStatus: 'PAID', amount: '1.00' })
      .expect(400);
  });

  it('blocks IDOR: user B cannot read user A order/address', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/addresses/${addressAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });
  });

  it('PRODUCT_MANAGER cannot approve bank transfers or mutate accounting', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/accounting/transactions')
      .set('Authorization', `Bearer ${productManagerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/admin/accounting/manual')
      .set('Authorization', `Bearer ${productManagerToken}`)
      .send({
        customerId: userAId,
        direction: 'DEBIT',
        amount: '10.00',
        description: 'should fail',
      })
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-transfers')
      .set('Authorization', `Bearer ${productManagerToken}`)
      .expect(403);
  });

  it('ACCOUNTING can read financial admin endpoints', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-transfers')
      .set('Authorization', `Bearer ${accountingToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/accounting/transactions')
      .set('Authorization', `Bearer ${accountingToken}`)
      .expect(200);
  });

  it('rate-limits repeated login attempts with 429', async () => {
    const email = `sec.ratelimit.${suffix}@example.com`;
    await authService.register({
      email,
      password: 'Password123!',
      firstName: 'Rate',
      lastName: 'Limit',
      userType: UserType.INDIVIDUAL,
    });

    let saw429 = false;
    for (let i = 0; i < 12; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword!!!' });
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  }, 60_000);
});
