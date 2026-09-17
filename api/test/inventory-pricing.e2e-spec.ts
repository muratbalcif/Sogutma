import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminRoleCode, PriceType, UserType } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { AdminService } from '../src/modules/admin/admin.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('Inventory & Pricing (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;
  let adminService: AdminService;
  let inventoryService: InventoryService;
  let adminToken: string;
  let individualToken: string;
  let corporateToken: string;
  let individualUserId: string;
  let productId: string;
  let productSlug: string;
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

    const adminAuth = await authService.register({
      email: `inv.admin.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Admin',
      lastName: 'Stock',
      userType: UserType.INDIVIDUAL,
    });
    await adminService.assignRoleToUser(
      adminAuth.user.id,
      AdminRoleCode.SUPER_ADMIN,
    );
    adminToken = (
      await authService.login({
        email: `inv.admin.${suffix}@example.com`,
        password: 'Password123!',
      })
    ).accessToken;

    const individual = await authService.register({
      email: `inv.individual.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Individual',
      lastName: 'Buyer',
      userType: UserType.INDIVIDUAL,
    });
    individualToken = individual.accessToken;
    individualUserId = individual.user.id;

    const corporate = await authService.register({
      email: `inv.corporate.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Corporate',
      lastName: 'Buyer',
      userType: UserType.CORPORATE,
    });
    corporateToken = corporate.accessToken;

    const brand = await prisma.brand.create({
      data: {
        name: `Brand Inv ${suffix}`,
        slug: `brand-inv-${suffix}`,
      },
    });
    const category = await prisma.category.create({
      data: {
        name: `Category Inv ${suffix}`,
        slug: `category-inv-${suffix}`,
      },
    });
    const product = await prisma.product.create({
      data: {
        sku: `INV-${suffix}`,
        name: `Inventory Product ${suffix}`,
        slug: `inventory-product-${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        vatRate: 20,
        inventory: {
          create: {
            quantity: 0,
            reservedQuantity: 0,
            minimumQuantity: 5,
          },
        },
      },
    });
    productId = product.id;
    productSlug = product.slug;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.inventoryTransaction.deleteMany({
        where: { productId },
      });
      await prisma.customerPrice.deleteMany({
        where: { productId },
      });
      await prisma.productPrice.deleteMany({
        where: { productId },
      });
      await prisma.inventory.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({
        where: { sku: { startsWith: `INV-${suffix}` } },
      });
      await prisma.brand.deleteMany({
        where: { slug: `brand-inv-${suffix}` },
      });
      await prisma.category.deleteMany({
        where: { slug: `category-inv-${suffix}` },
      });

      const users = await prisma.user.findMany({
        where: { email: { contains: `inv.` } },
        select: { id: true },
      });
      const userIds = users.map((user) => user.id);
      if (userIds.length > 0) {
        await prisma.refreshToken.deleteMany({
          where: { userId: { in: userIds } },
        });
        const admins = await prisma.adminUser.findMany({
          where: { userId: { in: userIds } },
          select: { id: true },
        });
        const adminIds = admins.map((admin) => admin.id);
        if (adminIds.length > 0) {
          await prisma.adminUserRole.deleteMany({
            where: { adminUserId: { in: adminIds } },
          });
          await prisma.adminUser.deleteMany({
            where: { id: { in: adminIds } },
          });
        }
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  it('manages inventory, pricing resolution and concurrent reservations', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/inventory/${productId}/increase`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 10, note: 'initial stock' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({
          quantity: 10,
          reservedQuantity: 0,
          availableQuantity: 10,
        });
      });

    // Nest default for POST without @HttpCode is 201 - but our controller doesn't set HttpCode
    // Actually POST returns 201 by default in Nest. Wait - we used expect(201) but Inventory controller
    // might return 200 if we need to check - Nest POST is 201 by default. Good.

    await request(app.getHttpServer())
      .post(`/api/v1/admin/inventory/${productId}/decrease`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 2 })
      .expect(201);

    const inventory = await request(app.getHttpServer())
      .get(`/api/v1/admin/inventory/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(inventory.body).toMatchObject({
      quantity: 8,
      availableQuantity: 8,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/admin/inventory/${productId}/transactions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect((res.body as { items: unknown[] }).items.length).toBeGreaterThan(
          0,
        );
      });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/pricing/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: PriceType.RETAIL, price: '1000.00' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/pricing/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: PriceType.CAMPAIGN, price: '900.00' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/pricing/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: PriceType.WHOLESALE, price: '800.00' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/pricing/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: PriceType.CORPORATE, price: '750.00' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/pricing/customers/${individualUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId, price: '700.00' })
      .expect(201);

    const anonymous = await request(app.getHttpServer())
      .get(`/api/v1/products/${productSlug}`)
      .expect(200);
    expect(anonymous.body).toMatchObject({
      price: { amount: '900.00', type: PriceType.CAMPAIGN, currency: 'TRY' },
      stock: { available: true, quantity: 8 },
    });

    const individual = await request(app.getHttpServer())
      .get(`/api/v1/products/${productSlug}`)
      .set('Authorization', `Bearer ${individualToken}`)
      .expect(200);
    expect(individual.body).toMatchObject({
      price: { amount: '700.00', type: 'CUSTOMER' },
    });

    const corporate = await request(app.getHttpServer())
      .get(`/api/v1/products/${productSlug}`)
      .set('Authorization', `Bearer ${corporateToken}`)
      .expect(200);
    expect(corporate.body).toMatchObject({
      price: { amount: '750.00', type: PriceType.CORPORATE },
    });

    // Reset stock for concurrency scenario: quantity=10, reserved=0
    await request(app.getHttpServer())
      .post(`/api/v1/admin/inventory/${productId}/adjust`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 10 })
      .expect(201);

    const results = await Promise.allSettled([
      inventoryService.reserveStock(productId, 6),
      inventoryService.reserveStock(productId, 6),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const finalInventory = await inventoryService.getInventory(productId);
    expect(finalInventory.quantity).toBe(10);
    expect(finalInventory.reservedQuantity).toBe(6);
    expect(finalInventory.availableQuantity).toBe(4);
    expect(finalInventory.reservedQuantity).toBeLessThanOrEqual(
      finalInventory.quantity,
    );

    await request(app.getHttpServer())
      .get('/api/v1/admin/inventory/critical')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
