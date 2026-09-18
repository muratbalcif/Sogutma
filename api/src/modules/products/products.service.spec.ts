import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductsService } from './products.service';
import { ProductSort } from './dto/product-query.dto';

describe('ProductsService', () => {
  const prisma = {
    product: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    brand: { findUnique: jest.fn() },
    category: { findUnique: jest.fn() },
    inventory: { create: jest.fn() },
    orderItem: { count: jest.fn() },
    productImage: {
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    productAttribute: { deleteMany: jest.fn() },
    productCompatibility: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const inventoryService = {
    toPublicStock: jest.fn().mockReturnValue({ available: false, quantity: 0 }),
  };
  const priceService = {
    resolvePrice: jest.fn().mockResolvedValue(null),
    resolvePricesForProducts: jest
      .fn()
      .mockResolvedValue(new Map([['p1', null]])),
  };
  const storage = {
    deleteObject: jest.fn().mockResolvedValue(undefined),
  };
  const audit = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const service = new ProductsService(
    prisma as never,
    inventoryService as never,
    priceService as never,
    storage as never,
    audit as never,
  );

  const brand = {
    id: 'brand-1',
    name: 'Arçelik',
    slug: 'arcelik',
    logo: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const category = {
    id: 'cat-1',
    parentId: null,
    name: 'Split Klima',
    slug: 'split-klima',
    image: null,
    sortOrder: 1,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  it('creates product with relations', async () => {
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.brand.findUnique.mockResolvedValue(brand);
    prisma.category.findUnique.mockResolvedValue(category);
    prisma.product.create.mockResolvedValue({
      id: 'p1',
      sku: 'SKU-1',
      barcode: '123',
      name: 'Klima',
      slug: 'klima',
      description: 'desc',
      metaTitle: null,
      metaDescription: null,
      technicalHtml: null,
      compatibilityHtml: null,
      brandId: brand.id,
      categoryId: category.id,
      vatRate: new Prisma.Decimal(20),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      brand,
      category,
      images: [],
      attributes: [{ id: 'a1', name: 'Gaz Tipi', value: 'R32', sortOrder: 1 }],
      compatibility: [],
      inventory: null,
    });
    prisma.inventory.create.mockResolvedValue({});
    prisma.product.findUniqueOrThrow.mockResolvedValue({
      id: 'p1',
      sku: 'SKU-1',
      barcode: '123',
      name: 'Klima',
      slug: 'klima',
      description: 'desc',
      metaTitle: null,
      metaDescription: null,
      technicalHtml: null,
      compatibilityHtml: null,
      brandId: brand.id,
      categoryId: category.id,
      vatRate: new Prisma.Decimal(20),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      brand,
      category,
      images: [],
      attributes: [{ id: 'a1', name: 'Gaz Tipi', value: 'R32', sortOrder: 1 }],
      compatibility: [],
      inventory: {
        id: 'inv1',
        productId: 'p1',
        quantity: 0,
        reservedQuantity: 0,
        minimumQuantity: 0,
      },
    });

    const result = await service.create({
      sku: 'SKU-1',
      barcode: '123',
      name: 'Klima',
      slug: 'klima',
      brandId: brand.id,
      categoryId: category.id,
      vatRate: 20,
      attributes: [{ name: 'Gaz Tipi', value: 'R32' }],
    });

    expect(result.attributes[0].value).toBe('R32');
    expect(result.vatRate).toBe('20.00');
    expect(result.technicalHtml).toBeNull();
    expect(result.compatibilityHtml).toBeNull();
    expect(prisma.inventory.create).toHaveBeenCalled();
  });

  it('sanitizes technicalHtml on create', async () => {
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.brand.findUnique.mockResolvedValue(brand);
    prisma.category.findUnique.mockResolvedValue(category);
    const created = {
      id: 'p1',
      sku: 'SKU-2',
      barcode: null,
      name: 'Klima',
      slug: 'klima-2',
      description: null,
      metaTitle: null,
      metaDescription: null,
      technicalHtml: '<p>OK</p>',
      compatibilityHtml: null,
      brandId: brand.id,
      categoryId: category.id,
      vatRate: new Prisma.Decimal(20),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      brand,
      category,
      images: [],
      attributes: [],
      compatibility: [],
      inventory: {
        id: 'inv1',
        productId: 'p1',
        quantity: 0,
        reservedQuantity: 0,
        minimumQuantity: 0,
      },
    };
    prisma.product.create.mockImplementation(
      async (args: { data: { technicalHtml?: string | null } }) => {
        expect(args.data.technicalHtml).toBe('<p>OK</p>');
        expect(args.data.technicalHtml).not.toContain('script');
        return created;
      },
    );
    prisma.inventory.create.mockResolvedValue({});
    prisma.product.findUniqueOrThrow.mockResolvedValue(created);

    const result = await service.create({
      sku: 'SKU-2',
      name: 'Klima',
      slug: 'klima-2',
      brandId: brand.id,
      categoryId: category.id,
      vatRate: 20,
      technicalHtml: '<p>OK</p><script>alert(1)</script>',
    });

    expect(result.technicalHtml).toBe('<p>OK</p>');
  });

  it('rejects duplicate SKU', async () => {
    prisma.product.findFirst.mockImplementation(
      (args: { where: { sku?: string; slug?: string } }) => {
        if (args.where.sku === 'SKU-1') {
          return Promise.resolve({ id: 'existing' });
        }
        return Promise.resolve(null);
      },
    );
    prisma.brand.findUnique.mockResolvedValue(brand);
    prisma.category.findUnique.mockResolvedValue(category);

    await expect(
      service.create({
        sku: 'SKU-1',
        name: 'Klima',
        slug: 'klima-2',
        brandId: brand.id,
        categoryId: category.id,
        vatRate: 20,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid brand', async () => {
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.brand.findUnique.mockResolvedValue(null);
    prisma.category.findUnique.mockResolvedValue(category);

    await expect(
      service.create({
        sku: 'SKU-1',
        name: 'Klima',
        slug: 'klima',
        brandId: brand.id,
        categoryId: category.id,
        vatRate: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces active=true for public listing', async () => {
    prisma.product.count.mockResolvedValue(0);
    prisma.product.findMany.mockResolvedValue([]);

    await service.findPublic({ page: 1, limit: 20, sort: ProductSort.NEWEST });

    expect(prisma.product.count).toHaveBeenCalledWith({
      where: { active: true },
    });
  });

  it('returns related products excluding current', async () => {
    prisma.product.findFirst.mockResolvedValue({
      id: 'p1',
      categoryId: category.id,
      brandId: brand.id,
    });
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p2',
        sku: 'SKU-2',
        barcode: null,
        name: 'Other',
        slug: 'other',
        description: null,
        brandId: brand.id,
        categoryId: category.id,
        vatRate: new Prisma.Decimal(20),
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        brand,
        category,
        images: [],
        inventory: null,
      },
    ]);
    priceService.resolvePricesForProducts.mockResolvedValue(
      new Map([['p2', null]]),
    );

    const related = await service.findRelated('klima');
    expect(related).toHaveLength(1);
    expect(related[0]?.slug).toBe('other');
    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
  });

  it('throws when related product slug missing', async () => {
    prisma.product.findFirst.mockResolvedValue(null);
    await expect(service.findRelated('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
