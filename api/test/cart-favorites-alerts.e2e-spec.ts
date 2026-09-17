import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PriceType, UserType } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

type CartBody = {
  id: string;
  items: Array<{
    quantity: number;
    unitPrice: string | null;
    subtotal: string | null;
    product: { images: unknown[] };
  }>;
  summary: { total: string; currency: string };
};

type ValidationBody = {
  valid: boolean;
  issues: unknown[];
};

describe('Cart, Favorites & Product Alerts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let productId: string;
  let campaignPriceId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    authService = app.get(AuthService);

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

    const userA = await authService.register({
      email: `cart.a.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Cart',
      lastName: 'Alpha',
      userType: UserType.INDIVIDUAL,
    });
    userAToken = userA.accessToken;
    userAId = userA.user.id;

    const userB = await authService.register({
      email: `cart.b.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Cart',
      lastName: 'Beta',
      userType: UserType.INDIVIDUAL,
    });
    userBToken = userB.accessToken;
    userBId = userB.user.id;

    const brand = await prisma.brand.create({
      data: {
        name: `Brand Cart ${suffix}`,
        slug: `brand-cart-${suffix}`,
      },
    });
    const category = await prisma.category.create({
      data: {
        name: `Category Cart ${suffix}`,
        slug: `category-cart-${suffix}`,
      },
    });
    const product = await prisma.product.create({
      data: {
        sku: `CART-${suffix}`,
        name: `Cart Product ${suffix}`,
        slug: `cart-product-${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        vatRate: 20,
        images: {
          create: [
            {
              url: 'https://cdn.example.com/cart-product.jpg',
              alt: 'Cart product',
              sortOrder: 0,
              isPrimary: true,
            },
          ],
        },
        inventory: {
          create: {
            quantity: 20,
            reservedQuantity: 0,
            minimumQuantity: 1,
          },
        },
        prices: {
          create: [
            {
              type: PriceType.RETAIL,
              price: '1000.00',
              currency: 'TRY',
              active: true,
            },
            {
              type: PriceType.CAMPAIGN,
              price: '900.00',
              currency: 'TRY',
              active: true,
            },
          ],
        },
      },
      include: { prices: true },
    });
    productId = product.id;
    campaignPriceId = product.prices.find(
      (price) => price.type === PriceType.CAMPAIGN,
    )!.id;
  });

  afterAll(async () => {
    await prisma.cartItem.deleteMany({
      where: { cart: { userId: { in: [userAId, userBId] } } },
    });
    await prisma.cart.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.favorite.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.productAlert.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    if (productId) {
      await prisma.productPrice.deleteMany({ where: { productId } });
      await prisma.productImage.deleteMany({ where: { productId } });
      await prisma.inventoryTransaction.deleteMany({ where: { productId } });
      await prisma.inventory.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    await prisma.brand.deleteMany({
      where: { slug: `brand-cart-${suffix}` },
    });
    await prisma.category.deleteMany({
      where: { slug: `category-cart-${suffix}` },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
    await app.close();
  });

  it('requires authentication for cart endpoints', async () => {
    await request(app.getHttpServer()).get('/api/v1/cart').expect(401);
  });

  it('rejects client-supplied price fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        productId,
        quantity: 2,
        unitPrice: '1.00',
        total: '2.00',
      })
      .expect(400);
  });

  it('adds items using campaign price and recalculates totals', async () => {
    const add = await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ productId, quantity: 2 })
      .expect(201);

    const addBody = add.body as CartBody;
    expect(addBody.items).toHaveLength(1);
    expect(addBody.items[0].unitPrice).toBe('900.00');
    expect(addBody.items[0].subtotal).toBe('1800.00');
    expect(addBody.summary.total).toBe('1800.00');
    expect(addBody.summary.currency).toBe('TRY');

    const get = await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    const getBody = get.body as CartBody;
    expect(getBody.items[0].unitPrice).toBe('900.00');
    expect(getBody.items[0].product.images).toHaveLength(1);
  });

  it('updates quantity, validates, removes item, and clears cart', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/cart/items/${productId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ quantity: 3 })
      .expect(200);

    const updatedBody = updated.body as CartBody;
    expect(updatedBody.items[0].quantity).toBe(3);
    expect(updatedBody.items[0].subtotal).toBe('2700.00');

    const validation = await request(app.getHttpServer())
      .post('/api/v1/cart/validate')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    const validationBody = validation.body as ValidationBody;
    expect(validationBody.valid).toBe(true);
    expect(validationBody.issues).toEqual([]);

    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/cart/items/${productId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    expect((removed.body as CartBody).items).toHaveLength(0);

    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    const cleared = await request(app.getHttpServer())
      .delete('/api/v1/cart')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect((cleared.body as CartBody).items).toHaveLength(0);
    const cartStillExists = await prisma.cart.findUnique({
      where: { userId: userAId },
    });
    expect(cartStillExists).not.toBeNull();
  });

  it('reflects price changes after campaign removal', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ productId, quantity: 2 })
      .expect(201);

    await prisma.productPrice.update({
      where: { id: campaignPriceId },
      data: { active: false },
    });

    const cart = await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    const cartBody = cart.body as CartBody;
    expect(cartBody.items[0].unitPrice).toBe('1000.00');
    expect(cartBody.items[0].subtotal).toBe('2000.00');
    expect(cartBody.summary.total).toBe('2000.00');

    await prisma.productPrice.update({
      where: { id: campaignPriceId },
      data: { active: true },
    });
  });

  it('isolates carts between users', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    const userBCart = await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);

    expect((userBCart.body as CartBody).items).toEqual([]);
  });

  it('rejects insufficient stock on cart add', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ productId, quantity: 100 })
      .expect(409);
  });

  it('manages favorites with user isolation', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/favorites/${productId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/favorites/${productId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(201);

    const listA = await request(app.getHttpServer())
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    expect(listA.body as unknown[]).toHaveLength(1);

    const checkA = await request(app.getHttpServer())
      .get(`/api/v1/favorites/check/${productId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    expect((checkA.body as { isFavorite: boolean }).isFavorite).toBe(true);

    const listB = await request(app.getHttpServer())
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);
    expect(listB.body as unknown[]).toEqual([]);

    await request(app.getHttpServer())
      .delete(`/api/v1/favorites/${productId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    const checkAfter = await request(app.getHttpServer())
      .get(`/api/v1/favorites/check/${productId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    expect((checkAfter.body as { isFavorite: boolean }).isFavorite).toBe(false);
  });

  it('manages product alerts without sending notifications', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/alerts`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/alerts`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(201);

    const listA = await request(app.getHttpServer())
      .get('/api/v1/product-alerts')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    const alertsA = listA.body as Array<{ active: boolean }>;
    expect(alertsA).toHaveLength(1);
    expect(alertsA[0].active).toBe(true);

    const listB = await request(app.getHttpServer())
      .get('/api/v1/product-alerts')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);
    expect(listB.body as unknown[]).toEqual([]);

    await request(app.getHttpServer())
      .delete(`/api/v1/products/${productId}/alerts`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    const after = await request(app.getHttpServer())
      .get('/api/v1/product-alerts')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    expect(after.body as unknown[]).toEqual([]);
  });
});
