import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AdminRoleCode,
  OrderStatus,
  OutboxStatus,
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
import { EmailOutboxService } from '../src/modules/payments/email-outbox.service';
import { PaymentExpirationService } from '../src/modules/payments/payment-expiration.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { flushTestRedis } from './flush-redis';

type OrderBody = {
  id: string;
  orderNumber: string;
  status: string;
  payment: {
    id: string;
    status: string;
    method: string;
    pendingBankTransferId?: string | null;
    pendingBankTransferAmount?: string | null;
    pendingBankTransferBankName?: string | null;
    pendingBankTransferReference?: string | null;
  } | null;
  bankAccounts?: Array<{ iban: string }>;
};
type PaymentBody = {
  id: string;
  status: PaymentStatus;
  amount: string;
  method: PaymentMethod;
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
  let bankAccountId: string;
  const suffix = Date.now();

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

    const address = await prisma.address.create({
      data: {
        userId,
        title: 'Ev',
        firstName: 'Pay',
        lastName: 'User',
        phone: '5551112233',
        city: 'Istanbul',
        district: 'Kadikoy',
        addressLine: 'Test Cad. 1',
        isDefault: true,
      },
    });
    addressId = address.id;

    const bank = await prisma.companyBankAccount.create({
      data: {
        bankName: `Test Bank ${suffix}`,
        accountName: 'Furkan Soğutma',
        iban: `TR33${String(suffix).slice(-22).padStart(22, '0')}`,
        currency: 'TRY',
        active: true,
        sortOrder: 1,
      },
    });
    bankAccountId = bank.id;
  });

  beforeEach(async () => {
    // Bank-transfer endpoint is throttled (10/min); flush so suite volume does not 429.
    await flushTestRedis();
  });

  afterAll(async () => {
    await prisma.bankTransferNotification.deleteMany({
      where: { userId },
    });
    await prisma.accountTransaction.deleteMany({ where: { userId } });
    await prisma.payment.deleteMany({ where: { order: { userId } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId } } });
    await prisma.orderStatusHistory.deleteMany({
      where: { order: { userId } },
    });
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.address.deleteMany({ where: { userId } });
    await prisma.companyBankAccount.deleteMany({
      where: { id: bankAccountId },
    });
    await prisma.inventoryTransaction.deleteMany({
      where: { productId },
    });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.productPrice.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
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

  it('lists public bank accounts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/payment/bank-accounts')
      .expect(200);
    const body = res.body as Array<{
      id: string;
      iban: string;
      bankName: string;
      active?: boolean;
    }>;
    expect(body.some((a) => a.id === bankAccountId)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0]).not.toHaveProperty('active');
    expect(body[0].iban).toMatch(/^TR/i);
  });

  it('creates order with pending BANK_TRANSFER payment and paymentReference', async () => {
    const order = await createOrder();
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.payment?.method).toBe(PaymentMethod.BANK_TRANSFER);
    expect(order.payment?.status).toBe(PaymentStatus.PENDING);
    expect(order.bankAccounts?.length).toBeGreaterThan(0);

    const payment = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const paymentBody = payment.body as PaymentBody & {
      paymentReference?: string | null;
    };
    expect(paymentBody.paymentReference).toMatch(
      new RegExp(`^${order.orderNumber}-[A-F0-9]{6}$`),
    );
  });

  it('rejects credit card payment method', async () => {
    const order = await createOrder();
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ method: PaymentMethod.CREDIT_CARD })
      .expect(400);
  });

  it('bank transfer approval marks payment PAID and updates accounting', async () => {
    const order = await createOrder();
    expect(order.payment?.id).toBeTruthy();

    const payment = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ method: PaymentMethod.BANK_TRANSFER })
      .expect(201);

    const paymentBody = payment.body as PaymentBody;
    expect(paymentBody.status).toBe(PaymentStatus.PENDING);
    expect(paymentBody.amount).toBe('1000.00');
    expect(paymentBody.id).toBe(order.payment!.id);

    const full = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        bankAccountId,
        amount: '1000.00',
      })
      .expect(201);
    expect((full.body as { amountMismatch: boolean }).amountMismatch).toBe(
      false,
    );
    expect(
      (full.body as { referenceNumber: string | null }).referenceNumber,
    ).toMatch(new RegExp(`^${order.orderNumber}-[A-F0-9]{6}$`));

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        bankAccountId,
      })
      .expect(409);

    const notificationId = (full.body as { id: string }).id;

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-transfers')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/bank-transfers/${notificationId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/bank-transfers/${notificationId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
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
      Number((account.body as { totalCredit: string }).totalCredit),
    ).toBeGreaterThanOrEqual(1000);
    expect((account.body as { balance: string }).balance).toBeDefined();

    const txCount = await prisma.accountTransaction.count({
      where: { reference: `PAYMENT:BANK_TRANSFER:${notificationId}` },
    });
    expect(txCount).toBe(1);
  });

  it('supports partial bank transfers 300+200+500 → PAID', async () => {
    const order = await createOrder();

    const submitAndApprove = async (amount: string) => {
      const created = await request(app.getHttpServer())
        .post(`/api/v1/orders/${order.id}/bank-transfer`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          senderName: 'Murat Balci',
          transferDate: '2026-09-18',
          bankAccountId,
          amount,
        })
        .expect(201);
      const id = (created.body as { id: string }).id;
      await request(app.getHttpServer())
        .post(`/api/v1/admin/bank-transfers/${id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(201);
      return id;
    };

    await submitAndApprove('300.00');
    let payment = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect((payment.body as PaymentBody & { remainingAmount?: string }).status).toBe(
      PaymentStatus.PARTIALLY_PAID,
    );
    expect(
      (payment.body as { remainingAmount: string }).remainingAmount,
    ).toBe('700.00');

    await submitAndApprove('200.00');
    payment = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect((payment.body as PaymentBody).status).toBe(
      PaymentStatus.PARTIALLY_PAID,
    );
    expect(
      (payment.body as { remainingAmount: string }).remainingAmount,
    ).toBe('500.00');

    const lastId = await submitAndApprove('500.00');
    payment = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect((payment.body as PaymentBody).status).toBe(PaymentStatus.PAID);

    const orderDetail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect((orderDetail.body as OrderBody).status).toBe(OrderStatus.CONFIRMED);

    expect(
      await prisma.accountTransaction.count({
        where: { reference: `PAYMENT:BANK_TRANSFER:${lastId}` },
      }),
    ).toBe(1);
  });

  it('rejects overpayment on create and keeps single pending', async () => {
    const order = await createOrder();
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: 'Murat Balci',
        transferDate: '2026-09-18',
        amount: '300.00',
        bankAccountId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: 'Murat Balci',
        transferDate: '2026-09-18',
        amount: '100.00',
        bankAccountId,
      })
      .expect(409);

    const order2 = await createOrder();
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order2.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: 'Murat Balci',
        transferDate: '2026-09-18',
        amount: '1500.00',
        bankAccountId,
      })
      .expect(400);
  });

  it('allows only one concurrent PENDING claim per payment', async () => {
    const order = await createOrder();
    const payload = {
      senderName: 'Murat Balci',
      transferDate: '2026-09-18',
      amount: '300.00',
      bankAccountId,
    };

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/orders/${order.id}/bank-transfer`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload),
      request(app.getHttpServer())
        .post(`/api/v1/orders/${order.id}/bank-transfer`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const pendingCount = await prisma.bankTransferNotification.count({
      where: { orderId: order.id, status: 'PENDING' },
    });
    expect(pendingCount).toBe(1);

    const orderDetail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(
      (orderDetail.body as OrderBody).payment?.pendingBankTransferId,
    ).toBeTruthy();
    expect(
      (orderDetail.body as OrderBody).payment?.pendingBankTransferAmount,
    ).toBe('300.00');
  });

  it('allows a new claim after REJECT', async () => {
    const order = await createOrder();
    const first = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: 'Murat Balci',
        transferDate: '2026-09-18',
        bankAccountId,
      })
      .expect(201);

    let orderDetail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(
      (orderDetail.body as OrderBody).payment?.pendingBankTransferId,
    ).toBe((first.body as { id: string }).id);

    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/bank-transfers/${(first.body as { id: string }).id}/reject`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejectionReason: 'Eksik dekont' })
      .expect(201);

    orderDetail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(
      (orderDetail.body as OrderBody).payment?.pendingBankTransferId,
    ).toBeNull();

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: 'Murat Balci',
        transferDate: '2026-09-18',
        bankAccountId,
      })
      .expect(201);
  });

  it('allows a new claim after APPROVED when remaining > 0', async () => {
    const order = await createOrder();
    const first = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: 'Murat Balci',
        transferDate: '2026-09-18',
        amount: '300.00',
        bankAccountId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/bank-transfers/${(first.body as { id: string }).id}/approve`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: 'Murat Balci',
        transferDate: '2026-09-18',
        amount: '200.00',
        bankAccountId,
      })
      .expect(201);
  });

  it('blocks a new claim when remaining is 0', async () => {
    const order = await createOrder();
    const full = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: 'Murat Balci',
        transferDate: '2026-09-18',
        bankAccountId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/bank-transfers/${(full.body as { id: string }).id}/approve`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: 'Murat Balci',
        transferDate: '2026-09-18',
        bankAccountId,
      })
      .expect(409);
  });

  it('reject keeps payment pending and blocks double reject after approve', async () => {
    const order = await createOrder();
    const notification = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        bankAccountId,
      })
      .expect(201);

    const id = (notification.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/api/v1/admin/bank-transfers/${id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejectionReason: 'Dekont okunamadı' })
      .expect(201);

    const payment = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect((payment.body as PaymentBody).status).toBe(PaymentStatus.PENDING);

    const orderDetail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect((orderDetail.body as OrderBody).status).toBe(OrderStatus.PENDING);

    const retry = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/bank-transfer`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        bankAccountId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/bank-transfers/${(retry.body as { id: string }).id}/approve`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/bank-transfers/${(retry.body as { id: string }).id}/reject`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejectionReason: 'too late' })
      .expect(409);
  });

  it('expires pending payment and releases stock idempotently', async () => {
    const order = await createOrder();
    const paymentId = order.payment!.id;

    await prisma.payment.update({
      where: { id: paymentId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const inventoryBefore = await prisma.inventory.findUnique({
      where: { productId },
    });
    const reservedBefore = inventoryBefore?.reservedQuantity ?? 0;

    const expiration = app.get(PaymentExpirationService);

    const first: number = await expiration.expirePendingPayments();
    expect(first).toBeGreaterThanOrEqual(1);

    const second: number = await expiration.expirePendingPayments();
    expect(second).toBe(0);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });
    expect(payment?.status).toBe(PaymentStatus.CANCELLED);

    const cancelled = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(cancelled?.status).toBe(OrderStatus.CANCELLED);

    const inventory = await prisma.inventory.findUnique({
      where: { productId },
    });
    expect(inventory?.reservedQuantity).toBe(reservedBefore - 1);
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
    expect(ids.size).toBe(1);
    expect([...ids][0]).toBe(order.payment!.id);
  });

  it('email outbox atomic claim prevents multi-worker double-send', async () => {
    const emailOutbox = app.get(EmailOutboxService);
    const row = await prisma.emailOutbox.create({
      data: {
        event: `E2E_RACE_${suffix}`,
        toEmail: `race.${suffix}@example.com`,
        subject: 'Concurrency test',
        payload: { html: '<p>race</p>' },
      },
    });

    // Defer unrelated pending rows so this race only sees our message.
    await prisma.emailOutbox.updateMany({
      where: { id: { not: row.id }, processedAt: null },
      data: { availableAt: new Date('2099-01-01T00:00:00.000Z') },
    });

    const sendSpy = jest
      .spyOn(emailOutbox, 'sendEmail')
      .mockResolvedValue({ ok: true });

    try {
      const [a, b] = await Promise.all([
        emailOutbox.processPending(10),
        emailOutbox.processPending(10),
      ]);

      expect(a + b).toBe(1);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: `race.${suffix}@example.com`,
          subject: 'Concurrency test',
        }),
      );

      const stored = await prisma.emailOutbox.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(stored.processedAt).not.toBeNull();
      expect(stored.status).toBe(OutboxStatus.SENT);
      expect(stored.lastError).toBeNull();
    } finally {
      sendSpy.mockRestore();
    }
  });
});
