import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AdminRoleCode,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PriceType,
  UserType,
} from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { AdminService } from '../src/modules/admin/admin.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

type OrderBody = { id: string; orderNumber: string; status: string };
type PaymentBody = {
  id: string;
  status: PaymentStatus;
  amount: string;
  method: PaymentMethod;
  providerPaymentId: string | null;
};

describe('Payments & Accounting (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;
  let adminService: AdminService;
  let userToken: string;
  let adminToken: string;
  let userId: string;
  let productId: string;
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
      email: `pay.user.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Pay',
      lastName: 'User',
      userType: UserType.INDIVIDUAL,
    });
    userToken = user.accessToken;
    userId = user.user.id;

    const adminAuth = await authService.register({
      email: `pay.admin.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Pay',
      lastName: 'Admin',
      userType: UserType.INDIVIDUAL,
    });
    await adminService.assignRoleToUser(
      adminAuth.user.id,
      AdminRoleCode.SUPER_ADMIN,
    );
    adminToken = (
      await authService.login({
        email: `pay.admin.${suffix}@example.com`,
        password: 'Password123!',
      })
    ).accessToken;

    const brand = await prisma.brand.create({
      data: { name: `Brand Pay ${suffix}`, slug: `brand-pay-${suffix}` },
    });
    const category = await prisma.category.create({
      data: {
        name: `Category Pay ${suffix}`,
        slug: `category-pay-${suffix}`,
      },
    });
    const product = await prisma.product.create({
      data: {
        sku: `PAY-${suffix}`,
        name: `Pay Product ${suffix}`,
        slug: `pay-product-${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        vatRate: 20,
        inventory: {
          create: { quantity: 50, reservedQuantity: 0, minimumQuantity: 0 },
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

    const address = await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Ev',
        firstName: 'Pay',
        lastName: 'User',
        phone: '+905551110099',
        city: 'Mersin',
        district: 'Yenisehir',
        addressLine: 'Cadde 1',
        country: 'TR',
      })
      .expect(201);
    addressId = (address.body as { id: string }).id;
  });

  afterAll(async () => {
    await prisma.processedWebhookEvent.deleteMany({});
    await prisma.bankTransferNotification.deleteMany({
      where: { userId },
    });
    await prisma.accountTransaction.deleteMany({ where: { userId } });
    await prisma.payment.deleteMany({
      where: { order: { userId } },
    });
    await prisma.orderStatusHistory.deleteMany({
      where: { order: { userId } },
    });
    await prisma.orderItem.deleteMany({
      where: { order: { userId } },
    });
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.cartItem.deleteMany({
      where: { cart: { userId } },
    });
    await prisma.cart.deleteMany({ where: { userId } });
    await prisma.address.deleteMany({ where: { userId } });
    if (productId) {
      await prisma.inventoryTransaction.deleteMany({ where: { productId } });
      await prisma.productPrice.deleteMany({ where: { productId } });
      await prisma.inventory.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    await prisma.brand.deleteMany({ where: { slug: `brand-pay-${suffix}` } });
    await prisma.category.deleteMany({
      where: { slug: `category-pay-${suffix}` },
    });
    await prisma.refreshToken.deleteMany({
      where: {
        user: {
          email: {
            in: [
              `pay.user.${suffix}@example.com`,
              `pay.admin.${suffix}@example.com`,
            ],
          },
        },
      },
    });
    await prisma.adminUserRole.deleteMany({
      where: {
        adminUser: { user: { email: `pay.admin.${suffix}@example.com` } },
      },
    });
    await prisma.adminUser.deleteMany({
      where: { user: { email: `pay.admin.${suffix}@example.com` } },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            `pay.user.${suffix}@example.com`,
            `pay.admin.${suffix}@example.com`,
          ],
        },
      },
    });
    await app.close();
  });

  async function createOrder(): Promise<OrderBody> {
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        shippingAddressId: addressId,
        billingAddressId: addressId,
      })
      .expect(201);

    return created.body as OrderBody;
  }

  it('bank transfer approval marks payment PAID and updates accounting', async () => {
    const order = await createOrder();

    const payment = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ method: PaymentMethod.BANK_TRANSFER })
      .expect(201);

    const paymentBody = payment.body as PaymentBody;
    expect(paymentBody.status).toBe(PaymentStatus.PENDING);
    expect(paymentBody.amount).toBe('1000.00');

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: 'Murat Balci',
        senderIban: 'TR330006100519786457841326',
        transferDate: '2026-09-17',
        referenceNumber: 'ABC123',
        amount: '1.00',
      })
      .expect(400);

    const notification = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: 'Murat Balci',
        senderIban: 'TR330006100519786457841326',
        transferDate: '2026-09-17',
        referenceNumber: 'ABC123',
      })
      .expect(201);

    const notificationId = (notification.body as { id: string }).id;

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-transfers')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/bank-transfers/${notificationId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/bank-transfers/${notificationId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const paid = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect((paid.body as PaymentBody).status).toBe(PaymentStatus.PAID);

    const orderDetail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect((orderDetail.body as OrderBody).status).toBe(OrderStatus.CONFIRMED);

    const account = await request(app.getHttpServer())
      .get('/api/v1/account/current')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(
      (
        account.body as {
          totalDebit: string;
          totalCredit: string;
          balance: string;
        }
      ).totalDebit,
    ).toBe('1000.00');
    expect((account.body as { totalCredit: string }).totalCredit).toBe(
      '1000.00',
    );
    expect((account.body as { balance: string }).balance).toBe('0.00');

    const txCount = await prisma.accountTransaction.count({
      where: { reference: `PAYMENT:${paymentBody.id}` },
    });
    expect(txCount).toBe(1);
  });

  it('development webhook is idempotent and confirms payment', async () => {
    const order = await createOrder();
    const payment = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', `idem-${suffix}-cc`)
      .send({ method: PaymentMethod.CREDIT_CARD })
      .expect(201);

    const paymentBody = payment.body as PaymentBody;
    expect(paymentBody.status).toBe(PaymentStatus.PENDING);
    expect(paymentBody.providerPaymentId).toBeTruthy();

    const again = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', `idem-${suffix}-cc`)
      .send({ method: PaymentMethod.CREDIT_CARD })
      .expect(201);
    expect((again.body as PaymentBody).id).toBe(paymentBody.id);

    const webhookPayload = {
      eventKey: `evt-${paymentBody.id}`,
      providerPaymentId: paymentBody.providerPaymentId,
      status: 'PAID',
    };

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/development')
      .set('x-dev-webhook-secret', 'dev-webhook-secret')
      .send(webhookPayload)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/development')
      .set('x-dev-webhook-secret', 'dev-webhook-secret')
      .send(webhookPayload)
      .expect(200);

    const paid = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect((paid.body as PaymentBody).status).toBe(PaymentStatus.PAID);

    const paymentCredits = await prisma.accountTransaction.count({
      where: { reference: `PAYMENT:${paymentBody.id}` },
    });
    expect(paymentCredits).toBe(1);

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/development')
      .send(webhookPayload)
      .expect(401);
  });

  it('rejects client amount on payment create and supports refund', async () => {
    const order = await createOrder();
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ method: PaymentMethod.CREDIT_CARD, amount: '1.00' })
      .expect(400);

    const payment = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ method: PaymentMethod.CREDIT_CARD })
      .expect(201);
    const paymentBody = payment.body as PaymentBody;

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/development')
      .set('x-dev-webhook-secret', 'dev-webhook-secret')
      .send({
        eventKey: `evt-refund-${paymentBody.id}`,
        providerPaymentId: paymentBody.providerPaymentId,
        status: 'PAID',
      })
      .expect(200);

    const refunded = await request(app.getHttpServer())
      .post(`/api/v1/admin/payments/${paymentBody.id}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect((refunded.body as PaymentBody).status).toBe(PaymentStatus.REFUNDED);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/payments/${paymentBody.id}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const refundTx = await prisma.accountTransaction.count({
      where: { reference: `REFUND:PAYMENT:${paymentBody.id}` },
    });
    expect(refundTx).toBe(1);
  });

  it('handles concurrent idempotent payment creation', async () => {
    const order = await createOrder();
    const key = `concurrent-${suffix}`;

    const results = await Promise.allSettled([
      request(app.getHttpServer())
        .post(`/api/v1/orders/${order.id}/payment`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', key)
        .send({ method: PaymentMethod.BANK_TRANSFER }),
      request(app.getHttpServer())
        .post(`/api/v1/orders/${order.id}/payment`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', key)
        .send({ method: PaymentMethod.BANK_TRANSFER }),
    ]);

    const bodies = results
      .filter((r) => r.status === 'fulfilled')
      .map(
        (r) => (r as PromiseFulfilledResult<{ body: PaymentBody }>).value.body,
      );

    const ids = new Set(bodies.map((b) => b.id).filter(Boolean));
    const count = await prisma.payment.count({
      where: { orderId: order.id, idempotencyKey: key },
    });
    expect(count).toBe(1);
    expect(ids.size).toBeLessThanOrEqual(1);
  });
});
