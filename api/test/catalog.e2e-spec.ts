import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminRoleCode, UserType } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { AdminService } from '../src/modules/admin/admin.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

interface ProductBody {
  id: string;
  slug: string;
  sku: string;
  active: boolean;
  name: string;
}

describe('Catalog (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;
  let adminService: AdminService;
  let adminToken: string;
  let userToken: string;
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

    const adminEmail = `catalog.admin.${suffix}@example.com`;
    const adminAuth = await authService.register({
      email: adminEmail,
      password: 'Password123!',
      firstName: 'Admin',
      lastName: 'User',
      userType: UserType.INDIVIDUAL,
    });
    await adminService.assignRoleToUser(
      adminAuth.user.id,
      AdminRoleCode.SUPER_ADMIN,
    );
    const adminLogin = await authService.login({
      email: adminEmail,
      password: 'Password123!',
    });
    adminToken = adminLogin.accessToken;

    const userAuth = await authService.register({
      email: `catalog.user.${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Regular',
      lastName: 'User',
      userType: UserType.INDIVIDUAL,
    });
    userToken = userAuth.accessToken;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.inventoryTransaction.deleteMany();
      await prisma.customerPrice.deleteMany();
      await prisma.productPrice.deleteMany();
      await prisma.inventory.deleteMany();
      await prisma.productCompatibility.deleteMany();
      await prisma.productAttribute.deleteMany();
      await prisma.productImage.deleteMany();
      await prisma.product.deleteMany({
        where: { sku: { startsWith: `CAT-${suffix}` } },
      });
      await prisma.brand.deleteMany({
        where: { slug: { contains: `cat-${suffix}` } },
      });
      await prisma.category.deleteMany({
        where: { slug: { contains: `cat-${suffix}` } },
      });
      await prisma.refreshToken.deleteMany();
      await prisma.adminUserRole.deleteMany();
      await prisma.adminUser.deleteMany();
      await prisma.user.deleteMany({
        where: { email: { contains: `catalog.` } },
      });
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  it('supports public catalog and admin RBAC flows', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Forbidden',
        slug: `forbidden-${suffix}`,
      })
      .expect(403);

    const parentCategory = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Klima Test',
        slug: `klima-cat-${suffix}`,
        sortOrder: 1,
      })
      .expect(201);

    const childCategory = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Split Test',
        slug: `split-cat-${suffix}`,
        parentId: (parentCategory.body as { id: string }).id,
        sortOrder: 1,
      })
      .expect(201);

    const brand = await request(app.getHttpServer())
      .post('/api/v1/admin/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Arçelik Test',
        slug: `arcelik-cat-${suffix}`,
      })
      .expect(201);

    const productResponse = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: `CAT-${suffix}-001`,
        barcode: `869${suffix}001`,
        name: '12.000 BTU Split Klima Test',
        slug: `split-product-cat-${suffix}`,
        description: 'Test ürün açıklaması',
        brandId: (brand.body as { id: string }).id,
        categoryId: (childCategory.body as { id: string }).id,
        vatRate: 20,
        images: [
          {
            url: 'https://cdn.furkansogutma.local/dev/test-product.jpg',
            isPrimary: true,
            sortOrder: 1,
          },
        ],
        attributes: [
          { name: 'Soğutma Kapasitesi', value: '12000 BTU', sortOrder: 1 },
        ],
        compatibility: [
          { manufacturer: 'Arçelik', model: 'T-100', modelYear: 2024 },
        ],
      })
      .expect(201);

    const product = productResponse.body as ProductBody;
    expect(product.sku).toBe(`CAT-${suffix}-001`);

    const relatedProduct = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: `CAT-${suffix}-002`,
        name: 'Related Split',
        slug: `related-product-cat-${suffix}`,
        brandId: (brand.body as { id: string }).id,
        categoryId: (childCategory.body as { id: string }).id,
        vatRate: 20,
      })
      .expect(201);

    const categories = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .expect(200);
    expect(
      (categories.body as Array<{ slug: string; children: unknown[] }>).some(
        (item) => item.slug === `klima-cat-${suffix}`,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .get('/api/v1/brands')
      .expect(200)
      .expect((res) => {
        expect(
          (res.body as Array<{ slug: string }>).some(
            (item) => item.slug === `arcelik-cat-${suffix}`,
          ),
        ).toBe(true);
      });

    const products = await request(app.getHttpServer())
      .get('/api/v1/products?page=1&limit=20&category=split-cat-' + suffix)
      .expect(200);
    expect((products.body as { meta: { page: number } }).meta.page).toBe(1);
    expect(
      (products.body as { items: ProductBody[] }).items.some(
        (item) => item.slug === product.slug,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .get('/api/v1/products?limit=101')
      .expect(400);

    const search = await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .query({ q: `CAT-${suffix}-001` })
      .expect(200);
    expect((search.body as { items: ProductBody[] }).items).toHaveLength(1);

    await request(app.getHttpServer())
      .get(`/api/v1/products/${product.slug}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('attributes');
        expect(res.body).toHaveProperty('compatibility');
        expect(res.body).not.toHaveProperty('passwordHash');
      });

    const related = await request(app.getHttpServer())
      .get(`/api/v1/products/${product.slug}/related`)
      .expect(200);
    expect(
      (related.body as ProductBody[]).some(
        (item) => item.id === (relatedProduct.body as ProductBody).id,
      ),
    ).toBe(true);
    expect(
      (related.body as ProductBody[]).some((item) => item.id === product.id),
    ).toBe(false);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${product.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Split Klima' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/products/${product.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect((res.body as ProductBody).active).toBe(false);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/products/${product.slug}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(
        `/api/v1/admin/categories/${(parentCategory.body as { id: string }).id}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false })
      .expect(200);

    const publicCategories = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .expect(200);
    expect(
      (publicCategories.body as Array<{ slug: string }>).some(
        (item) => item.slug === `klima-cat-${suffix}`,
      ),
    ).toBe(false);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/brands/${(brand.body as { id: string }).id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const publicBrands = await request(app.getHttpServer())
      .get('/api/v1/brands')
      .expect(200);
    expect(
      (publicBrands.body as Array<{ slug: string }>).some(
        (item) => item.slug === `arcelik-cat-${suffix}`,
      ),
    ).toBe(false);
  });
});
