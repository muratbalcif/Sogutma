import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminRoleCode, PriceType, UserType } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { AdminService } from '../src/modules/admin/admin.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { AccountingService } from '../src/modules/payments/accounting.service';
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
  let superAdminToken: string;
  let superAdminUserId: string;
  let orderAId: string;
  let addressAId: string;
  let paymentAId: string;
  let bankTransferAId: string;
  let bankAccountId: string;

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
    app.useGlobalInterceptors(new LoggingInterceptor());
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

    const superAdmin = await authService.register({
      email: `sec.sa.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Super',
      lastName: 'Admin',
      userType: UserType.INDIVIDUAL,
    });
    await adminService.assignRoleToUser(
      superAdmin.user.id,
      AdminRoleCode.SUPER_ADMIN,
    );
    superAdminUserId = superAdmin.user.id;
    superAdminToken = (
      await authService.login({
        email: `sec.sa.${suffix}@example.com`,
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

    const payment = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderAId}/payment`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    paymentAId = (payment.body as { id: string }).id;

    const bank = await prisma.companyBankAccount.findFirst({
      where: { active: true },
      select: { id: true },
    });
    if (!bank) {
      throw new Error('No active company bank account for security e2e');
    }
    bankAccountId = bank.id;

    const transfer = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderAId}/bank-transfer`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        bankAccountId,
      })
      .expect(201);
    bankTransferAId = (transfer.body as { id: string }).id;
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

  it('RBAC role assignment is SUPER_ADMIN only; PATCH /auth/me updates profile', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/rbac/roles')
      .set('Authorization', `Bearer ${productManagerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/admin/rbac/assign')
      .set('Authorization', `Bearer ${productManagerToken}`)
      .send({ email: `sec.a.${suffix}@example.com`, roleCode: 'ORDER_MANAGER' })
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/admin/rbac/roles')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const patched = await request(app.getHttpServer())
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ firstName: 'SecA', phone: '+905551110000' })
      .expect(200);

    expect(patched.body.firstName).toBe('SecA');
    expect(patched.body.phone).toBe('+905551110000');
    expect(patched.body.email).toContain(`sec.a.${suffix}`);
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

  it('rate-limits forgot-password with 429', async () => {
    await flushTestRedis();
    let saw429 = false;
    for (let i = 0; i < 8; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: `sec.a.${suffix}@example.com` });
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  }, 60_000);

  it('rate-limits refresh with 429', async () => {
    await flushTestRedis();
    let saw429 = false;
    for (let i = 0; i < 35; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token-for-rate-limit' });
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  }, 60_000);

  it('rate-limits bank-transfer submissions with 429', async () => {
    await flushTestRedis();
    let saw429 = false;
    for (let i = 0; i < 12; i++) {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderAId}/bank-transfer`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          bankAccountId,
        });
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  }, 60_000);

  it('blocks IDOR on payment, bank transfer, and account of another user', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderAId}/payment`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/bank-transfers/${bankTransferAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });

    const accountB = await request(app.getHttpServer())
      .get('/api/v1/account/current')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);
    const accountA = await request(app.getHttpServer())
      .get('/api/v1/account/current')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    expect(accountB.body).not.toEqual(accountA.body);

    await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${userAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(403);
  });

  it('rejects client-supplied order total and cart price', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        shippingAddressId: addressAId,
        billingAddressId: addressAId,
        totalAmount: '1.00',
        price: '1.00',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        productId: (
          await prisma.product.findFirstOrThrow({
            where: { sku: `SEC-${suffix}` },
          })
        ).id,
        quantity: 1,
        price: '1.00',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderAId}/payment`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ method: 'BANK_TRANSFER', amount: '1.00' })
      .expect(400);

    const payment = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderAId}/payment`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    const orderDetail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderAId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    expect((payment.body as { amount: string }).amount).toBe(
      (orderDetail.body as { totalAmount: string }).totalAmount,
    );
    expect(Number((payment.body as { amount: string }).amount)).toBeGreaterThan(
      1,
    );
  });

  it('records a single CREDIT on double payment approval', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/bank-transfers/${bankTransferAId}/approve`)
      .set('Authorization', `Bearer ${accountingToken}`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/bank-transfers/${bankTransferAId}/approve`)
      .set('Authorization', `Bearer ${accountingToken}`)
      .send({})
      .expect(201);

    const credits = await prisma.accountTransaction.count({
      where: { reference: `PAYMENT:BANK_TRANSFER:${bankTransferAId}` },
    });
    expect(credits).toBe(1);
  });

  it('records a single DEBIT when the same order accounting event runs twice', async () => {
    const accounting = app.get(AccountingService);
    const reference = `SALE:ORDER:${orderAId}`;
    await accounting.recordIfAbsent({
      userId: userAId,
      orderId: orderAId,
      type: 'SALE',
      amount: '250.00',
      currency: 'TRY',
      description: 'order sale',
      reference,
      referenceType: 'ORDER',
      referenceId: orderAId,
    });
    await accounting.recordIfAbsent({
      userId: userAId,
      orderId: orderAId,
      type: 'SALE',
      amount: '250.00',
      currency: 'TRY',
      description: 'order sale retry',
      reference,
      referenceType: 'ORDER',
      referenceId: orderAId,
    });
    const count = await prisma.accountTransaction.count({
      where: { reference },
    });
    expect(count).toBe(1);
  });

  it('PRODUCT_MANAGER cannot mutate finance; ACCOUNTING and SUPER_ADMIN can', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/bank-transfers/${bankTransferAId}/approve`)
      .set('Authorization', `Bearer ${productManagerToken}`)
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/admin/accounting/manual')
      .set('Authorization', `Bearer ${productManagerToken}`)
      .send({
        customerId: userAId,
        direction: 'CREDIT',
        amount: '5.00',
        description: 'pm blocked',
      })
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${productManagerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/accounting/transactions')
      .set('Authorization', `Bearer ${accountingToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-transfers')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
  });

  it('rejects invalid upload MIME, extension, and oversized presign', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/uploads/presign')
      .set('Authorization', `Bearer ${productManagerToken}`)
      .send({ filename: 'xss.svg', contentType: 'image/svg+xml' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/uploads/presign')
      .set('Authorization', `Bearer ${productManagerToken}`)
      .send({ filename: 'payload.exe', contentType: 'image/jpeg' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/uploads/presign')
      .set('Authorization', `Bearer ${productManagerToken}`)
      .send({
        filename: 'huge.jpg',
        contentType: 'image/jpeg',
        contentLength: 50 * 1024 * 1024,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/imports/products/preview')
      .set('Authorization', `Bearer ${productManagerToken}`)
      .attach('file', Buffer.from('<svg></svg>'), 'payload.svg')
      .expect(400);

    const validJpeg = await request(app.getHttpServer())
      .post('/api/v1/admin/uploads/presign')
      .set('Authorization', `Bearer ${productManagerToken}`)
      .send({
        filename: 'product.jpg',
        contentType: 'image/jpeg',
        contentLength: 1024,
      });
    // 201 when R2 is configured; 503 when credentials are absent in test env.
    expect([201, 503]).toContain(validJpeg.status);
  });

  it('neutralizes CSV formula injection on customer export', async () => {
    await prisma.user.update({
      where: { id: userAId },
      data: { firstName: '=CMD()' },
    });
    const csv = await request(app.getHttpServer())
      .get('/api/v1/admin/customers/export')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    const body = String(csv.text ?? csv.body);
    expect(body).toContain("'=CMD()");
    expect(body).not.toMatch(/(^|,)=CMD\(\)/);
  });

  it('STOCK_MANAGER receives stock permissions and can read inventory', async () => {
    const stockUser = await authService.register({
      email: `sec.sm.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Stock',
      lastName: 'Manager',
      userType: UserType.INDIVIDUAL,
    });
    await adminService.assignRoleToUser(
      stockUser.user.id,
      AdminRoleCode.STOCK_MANAGER,
    );
    const access = await adminService.getAccessForUser(stockUser.user.id);
    expect(access.roles).toContain(AdminRoleCode.STOCK_MANAGER);
    expect(access.permissions).toEqual(
      expect.arrayContaining([
        'stock.read',
        'stock.update',
        'import.read',
        'import.create',
        'product.read',
      ]),
    );
    expect(access.permissions).not.toContain('payment.refund');

    const token = (
      await authService.login({
        email: `sec.sm.${suffix}@example.com`,
        password: 'Password123!',
      })
    ).accessToken;

    await request(app.getHttpServer())
      .get('/api/v1/admin/inventory')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-transfers')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('rejects demoting the last SUPER_ADMIN; allows when another remains', async () => {
    const second = await authService.register({
      email: `sec.sa2.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Super',
      lastName: 'Two',
      userType: UserType.INDIVIDUAL,
    });
    await adminService.assignRoleToUser(
      second.user.id,
      AdminRoleCode.SUPER_ADMIN,
    );

    await request(app.getHttpServer())
      .delete(
        `/api/v1/admin/rbac/users/${second.user.id}/roles/${AdminRoleCode.SUPER_ADMIN}`,
      )
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const superAdminRole = await prisma.adminRole.findUniqueOrThrow({
      where: { code: AdminRoleCode.SUPER_ADMIN },
    });
    const primaryAdmin = await prisma.adminUser.findUniqueOrThrow({
      where: { userId: superAdminUserId },
    });
    const otherLinks = await prisma.adminUserRole.findMany({
      where: {
        roleId: superAdminRole.id,
        adminUserId: { not: primaryAdmin.id },
      },
    });

    await prisma.adminUserRole.deleteMany({
      where: {
        roleId: superAdminRole.id,
        adminUserId: { not: primaryAdmin.id },
      },
    });

    try {
      await request(app.getHttpServer())
        .delete(
          `/api/v1/admin/rbac/users/${superAdminUserId}/roles/${AdminRoleCode.SUPER_ADMIN}`,
        )
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(409);
    } finally {
      for (const link of otherLinks) {
        await prisma.adminUserRole.create({
          data: {
            adminUserId: link.adminUserId,
            roleId: link.roleId,
          },
        });
      }
    }
  });

  it('ready returns 503 when database is down; live stays 200', async () => {
    const spy = jest
      .spyOn(prisma, '$queryRaw')
      .mockRejectedValue(new Error('database down'));
    try {
      await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(503);
    } finally {
      spy.mockRestore();
    }
  });

  it('HTTP logs include the response X-Request-Id', async () => {
    const chunks: string[] = [];
    const spy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((message: unknown) => {
        chunks.push(String(message));
      });
    try {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200);
      const requestId = res.headers['x-request-id'];
      expect(requestId).toBeTruthy();
      expect(chunks.some((line) => line.includes(requestId))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
