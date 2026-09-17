import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserType } from '@prisma/client';
import {
  PaginatedResponseDto,
  buildPaginatedResponse,
} from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { PriceService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../storage/r2-storage.service';
import {
  AdminProductQueryDto,
  ProductSearchQueryDto,
  ProductSort,
  PublicProductQueryDto,
} from './dto/product-query.dto';
import {
  ProductDetailDto,
  ProductImageResponseDto,
  ProductListItemDto,
} from './dto/product-response.dto';
import {
  BulkProductStatusDto,
  CreateProductDto,
  RegisterProductImageDto,
  ReorderImagesDto,
  UpdateProductDto,
} from './dto/product.dto';

const productListInclude = {
  brand: true,
  category: true,
  images: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  inventory: true,
} satisfies Prisma.ProductInclude;

const productDetailInclude = {
  ...productListInclude,
  attributes: { orderBy: { sortOrder: 'asc' as const } },
  compatibility: { orderBy: { manufacturer: 'asc' as const } },
} satisfies Prisma.ProductInclude;

type ProductListRecord = Prisma.ProductGetPayload<{
  include: typeof productListInclude;
}>;

type ProductDetailRecord = Prisma.ProductGetPayload<{
  include: typeof productDetailInclude;
}>;

export interface ProductViewerContext {
  customerId?: string;
  userType?: UserType;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly priceService: PriceService,
    private readonly storage: R2StorageService,
    private readonly audit: AuditService,
  ) {}

  toListItem(
    product: ProductListRecord,
    extras?: {
      price?: ProductListItemDto['price'];
      compareAtPrice?: ProductListItemDto['compareAtPrice'];
    },
  ): ProductListItemDto {
    const price = extras?.price ?? null;
    return {
      id: product.id,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      slug: product.slug,
      description: product.description,
      vatRate: product.vatRate.toFixed(2),
      active: product.active,
      isFeatured: product.isFeatured,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      brand: {
        id: product.brand.id,
        name: product.brand.name,
        slug: product.brand.slug,
        logo: product.brand.logo,
        active: product.brand.active,
      },
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
      images: product.images.map((image) => this.toImageResponse(image)),
      price,
      compareAtPrice: extras?.compareAtPrice ?? null,
      stock: this.inventoryService.toPublicStock(product.inventory),
      onCampaign: price?.type === 'CAMPAIGN',
    };
  }

  toDetail(
    product: ProductDetailRecord,
    extras?: {
      price?: ProductListItemDto['price'];
      compareAtPrice?: ProductListItemDto['compareAtPrice'];
    },
  ): ProductDetailDto {
    return {
      ...this.toListItem(product, extras),
      attributes: product.attributes.map((attribute) => ({
        id: attribute.id,
        name: attribute.name,
        value: attribute.value,
        sortOrder: attribute.sortOrder,
      })),
      compatibility: product.compatibility.map((item) => ({
        id: item.id,
        manufacturer: item.manufacturer,
        model: item.model,
        modelYear: item.modelYear,
        notes: item.notes,
      })),
    };
  }

  private toImageResponse(image: {
    id: string;
    url: string;
    objectKey: string | null;
    alt: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }): ProductImageResponseDto {
    return {
      id: image.id,
      url: image.url,
      objectKey: image.objectKey,
      alt: image.alt,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
    };
  }

  async findPublic(
    query: PublicProductQueryDto,
    viewer: ProductViewerContext = {},
  ): Promise<PaginatedResponseDto<ProductListItemDto>> {
    return this.findMany(
      {
        ...query,
        active: true,
      },
      viewer,
    );
  }

  async findFeatured(
    limit = 8,
    viewer: ProductViewerContext = {},
  ): Promise<ProductListItemDto[]> {
    const products = await this.prisma.product.findMany({
      where: { active: true, isFeatured: true },
      include: productListInclude,
      orderBy: [{ featuredSortOrder: 'asc' }, { updatedAt: 'desc' }],
      take: limit,
    });
    return this.enrichList(products, viewer);
  }

  async setFeatured(
    productId: string,
    input: { isFeatured: boolean; featuredSortOrder?: number },
    adminUserId?: string,
  ): Promise<ProductDetailDto> {
    const existing = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    const product = await this.prisma.product.update({
      where: { id: productId },
      data: {
        isFeatured: input.isFeatured,
        featuredSortOrder:
          input.featuredSortOrder ?? existing.featuredSortOrder,
      },
      include: productDetailInclude,
    });
    if (adminUserId) {
      await this.audit.log({
        adminUserId,
        action: 'FEATURED_PRODUCT_UPDATED',
        entityType: 'Product',
        entityId: productId,
        metadata: {
          isFeatured: input.isFeatured,
          featuredSortOrder: product.featuredSortOrder,
        },
      });
    }
    return this.toDetail(product);
  }

  async findBestSelling(
    limit = 8,
    viewer: ProductViewerContext = {},
  ): Promise<ProductListItemDto[]> {
    const result = await this.findMany(
      {
        page: 1,
        limit,
        active: true,
        sort: ProductSort.BEST_SELLING,
      },
      viewer,
    );
    return result.items;
  }

  async findCampaignProducts(
    limit = 8,
    viewer: ProductViewerContext = {},
  ): Promise<ProductListItemDto[]> {
    const result = await this.findMany(
      {
        page: 1,
        limit,
        active: true,
        onCampaign: true,
        sort: ProductSort.NEWEST,
      },
      viewer,
    );
    return result.items;
  }

  async findPublicByCategorySlug(
    categorySlug: string,
    query: PublicProductQueryDto,
    viewer: ProductViewerContext = {},
  ): Promise<PaginatedResponseDto<ProductListItemDto>> {
    return this.findMany(
      {
        ...query,
        category: categorySlug,
        active: true,
      },
      viewer,
    );
  }

  async searchPublic(
    query: ProductSearchQueryDto,
    viewer: ProductViewerContext = {},
  ): Promise<PaginatedResponseDto<ProductListItemDto>> {
    return this.findMany(
      {
        page: query.page,
        limit: query.limit,
        search: query.q,
        active: true,
        sort: ProductSort.NEWEST,
      },
      viewer,
    );
  }

  async findPublicBySlug(
    slug: string,
    viewer: ProductViewerContext = {},
  ): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findFirst({
      where: { slug, active: true },
      include: productDetailInclude,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const price = await this.priceService.resolvePrice(product.id, viewer);
    const retail = await this.priceService.resolvePrice(product.id, {});
    const compareAtPrice =
      price &&
      retail &&
      price.type !== 'RETAIL' &&
      retail.amount !== price.amount
        ? retail
        : null;
    return this.toDetail(product, { price, compareAtPrice });
  }

  async findRelated(
    slug: string,
    limit = 8,
    viewer: ProductViewerContext = {},
  ): Promise<ProductListItemDto[]> {
    const current = await this.prisma.product.findFirst({
      where: { slug, active: true },
      select: { id: true, categoryId: true, brandId: true },
    });
    if (!current) {
      throw new NotFoundException('Product not found');
    }

    const related = await this.prisma.product.findMany({
      where: {
        active: true,
        id: { not: current.id },
        OR: [{ categoryId: current.categoryId }, { brandId: current.brandId }],
      },
      include: productListInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return this.enrichList(related, viewer);
  }

  async findAllAdmin(
    query: AdminProductQueryDto,
  ): Promise<PaginatedResponseDto<ProductListItemDto>> {
    return this.findMany(query);
  }

  async findAdminById(id: string): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productDetailInclude,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const price = await this.priceService.resolvePrice(product.id);
    return this.toDetail(product, { price });
  }

  async create(
    dto: CreateProductDto,
    adminUserId?: string,
  ): Promise<ProductDetailDto> {
    await this.ensureUniqueFields(dto.sku, dto.slug, dto.barcode);
    await this.ensureBrandAndCategory(dto.brandId, dto.categoryId);
    this.ensureSinglePrimaryImage(dto.images);

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku: dto.sku,
          barcode: dto.barcode,
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          metaTitle: dto.metaTitle,
          metaDescription: dto.metaDescription,
          brandId: dto.brandId,
          categoryId: dto.categoryId,
          vatRate: new Prisma.Decimal(dto.vatRate),
          active: dto.active ?? true,
          images: dto.images
            ? {
                create: dto.images.map((image) => ({
                  url: image.url,
                  objectKey: image.objectKey,
                  alt: image.alt,
                  sortOrder: image.sortOrder ?? 0,
                  isPrimary: image.isPrimary ?? false,
                })),
              }
            : undefined,
          attributes: dto.attributes
            ? {
                create: dto.attributes.map((attribute) => ({
                  name: attribute.name,
                  value: attribute.value,
                  sortOrder: attribute.sortOrder ?? 0,
                })),
              }
            : undefined,
          compatibility: dto.compatibility
            ? {
                create: dto.compatibility.map((item) => ({
                  manufacturer: item.manufacturer,
                  model: item.model,
                  modelYear: item.modelYear,
                  notes: item.notes,
                })),
              }
            : undefined,
        },
        include: productDetailInclude,
      });
      await tx.inventory.create({
        data: {
          productId: created.id,
          quantity: 0,
          reservedQuantity: 0,
          minimumQuantity: 0,
        },
      });
      return tx.product.findUniqueOrThrow({
        where: { id: created.id },
        include: productDetailInclude,
      });
    });

    if (adminUserId) {
      await this.audit.log({
        adminUserId,
        action: 'PRODUCT_CREATED',
        entityType: 'Product',
        entityId: product.id,
        metadata: { sku: product.sku },
      });
    }

    return this.toDetail(product);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    adminUserId?: string,
  ): Promise<ProductDetailDto> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    if (dto.sku || dto.slug || dto.barcode !== undefined) {
      await this.ensureUniqueFields(
        dto.sku ?? existing.sku,
        dto.slug ?? existing.slug,
        dto.barcode === undefined ? existing.barcode : dto.barcode,
        id,
      );
    }

    if (dto.brandId || dto.categoryId) {
      await this.ensureBrandAndCategory(
        dto.brandId ?? existing.brandId,
        dto.categoryId ?? existing.categoryId,
      );
    }

    if (dto.images) {
      this.ensureSinglePrimaryImage(dto.images);
    }

    const product = await this.prisma.$transaction(async (tx) => {
      if (dto.images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
      }
      if (dto.attributes) {
        await tx.productAttribute.deleteMany({ where: { productId: id } });
      }
      if (dto.compatibility) {
        await tx.productCompatibility.deleteMany({ where: { productId: id } });
      }

      return tx.product.update({
        where: { id },
        data: {
          sku: dto.sku,
          barcode: dto.barcode,
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          metaTitle: dto.metaTitle,
          metaDescription: dto.metaDescription,
          brandId: dto.brandId,
          categoryId: dto.categoryId,
          vatRate:
            dto.vatRate === undefined
              ? undefined
              : new Prisma.Decimal(dto.vatRate),
          active: dto.active,
          images: dto.images
            ? {
                create: dto.images.map((image) => ({
                  url: image.url,
                  objectKey: image.objectKey,
                  alt: image.alt,
                  sortOrder: image.sortOrder ?? 0,
                  isPrimary: image.isPrimary ?? false,
                })),
              }
            : undefined,
          attributes: dto.attributes
            ? {
                create: dto.attributes.map((attribute) => ({
                  name: attribute.name,
                  value: attribute.value,
                  sortOrder: attribute.sortOrder ?? 0,
                })),
              }
            : undefined,
          compatibility: dto.compatibility
            ? {
                create: dto.compatibility.map((item) => ({
                  manufacturer: item.manufacturer,
                  model: item.model,
                  modelYear: item.modelYear,
                  notes: item.notes,
                })),
              }
            : undefined,
        },
        include: productDetailInclude,
      });
    });

    if (adminUserId) {
      const action =
        dto.active === undefined
          ? 'PRODUCT_UPDATED'
          : dto.active
            ? 'PRODUCT_ACTIVATED'
            : 'PRODUCT_DEACTIVATED';
      await this.audit.log({
        adminUserId,
        action: dto.active === undefined ? 'PRODUCT_UPDATED' : action,
        entityType: 'Product',
        entityId: id,
        metadata: { sku: product.sku, fields: Object.keys(dto) },
      });
    }

    return this.toDetail(product);
  }

  async softDelete(
    id: string,
    adminUserId?: string,
  ): Promise<ProductDetailDto> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const orderItemCount = await this.prisma.orderItem.count({
      where: { productId: id },
    });

    // Never hard-delete; preserve order history snapshots via soft deactivate.
    const product = await this.prisma.product.update({
      where: { id },
      data: { active: false },
      include: productDetailInclude,
    });
    if (adminUserId) {
      await this.audit.log({
        adminUserId,
        action: 'PRODUCT_DEACTIVATED',
        entityType: 'Product',
        entityId: id,
        metadata: {
          sku: product.sku,
          reason: orderItemCount > 0 ? 'has_order_history' : 'admin_delete',
        },
      });
    }
    return this.toDetail(product);
  }

  async bulkSetActive(
    dto: BulkProductStatusDto,
    adminUserId: string,
  ): Promise<{ updated: number }> {
    if (dto.productIds.length === 0) {
      throw new BadRequestException('productIds required');
    }
    if (dto.productIds.length > 500) {
      throw new BadRequestException('Max 500 products per bulk status update');
    }
    const result = await this.prisma.product.updateMany({
      where: { id: { in: dto.productIds } },
      data: { active: dto.active },
    });
    await this.audit.log({
      adminUserId,
      action: dto.active ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
      entityType: 'Product',
      entityId: null,
      metadata: {
        productIds: dto.productIds,
        updated: result.count,
        active: dto.active,
      },
    });
    return { updated: result.count };
  }

  async registerImage(
    productId: string,
    dto: RegisterProductImageDto,
    adminUserId: string,
  ): Promise<ProductImageResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const image = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.productImage.updateMany({
          where: { productId },
          data: { isPrimary: false },
        });
      }
      const count = await tx.productImage.count({ where: { productId } });
      return tx.productImage.create({
        data: {
          productId,
          url: dto.url,
          objectKey: dto.objectKey,
          alt: dto.alt,
          sortOrder: count,
          isPrimary: dto.isPrimary ?? count === 0,
        },
      });
    });

    await this.audit.log({
      adminUserId,
      action: 'IMAGE_UPLOADED',
      entityType: 'ProductImage',
      entityId: image.id,
      metadata: { productId, objectKey: dto.objectKey },
    });

    return this.toImageResponse(image);
  }

  async deleteImage(
    productId: string,
    imageId: string,
    adminUserId: string,
  ): Promise<{ deleted: true }> {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) {
      throw new NotFoundException('Image not found');
    }

    await this.prisma.productImage.delete({ where: { id: imageId } });

    if (image.objectKey) {
      try {
        await this.storage.deleteObject(image.objectKey);
      } catch {
        // R2 failure after DB delete — orphan cleanup via objectKey index later
      }
    }

    if (image.isPrimary) {
      const next = await this.prisma.productImage.findFirst({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      });
      if (next) {
        await this.prisma.productImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }

    await this.audit.log({
      adminUserId,
      action: 'IMAGE_DELETED',
      entityType: 'ProductImage',
      entityId: imageId,
      metadata: { productId, objectKey: image.objectKey },
    });

    return { deleted: true };
  }

  async reorderImages(
    productId: string,
    dto: ReorderImagesDto,
  ): Promise<ProductImageResponseDto[]> {
    const images = await this.prisma.productImage.findMany({
      where: { productId },
    });
    if (images.length !== dto.imageIds.length) {
      throw new BadRequestException('imageIds must include all product images');
    }
    const idSet = new Set(images.map((i) => i.id));
    for (const id of dto.imageIds) {
      if (!idSet.has(id)) {
        throw new BadRequestException(`Unknown image id: ${id}`);
      }
    }

    await this.prisma.$transaction(
      dto.imageIds.map((id, index) =>
        this.prisma.productImage.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    const updated = await this.prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
    return updated.map((img) => this.toImageResponse(img));
  }

  async setPrimaryImage(
    productId: string,
    imageId: string,
  ): Promise<ProductImageResponseDto> {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) {
      throw new NotFoundException('Image not found');
    }

    await this.prisma.$transaction([
      this.prisma.productImage.updateMany({
        where: { productId },
        data: { isPrimary: false },
      }),
      this.prisma.productImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      }),
    ]);

    const updated = await this.prisma.productImage.findUniqueOrThrow({
      where: { id: imageId },
    });
    return this.toImageResponse(updated);
  }

  private async findMany(
    query: AdminProductQueryDto,
    viewer: ProductViewerContext = {},
  ): Promise<PaginatedResponseDto<ProductListItemDto>> {
    const where: Prisma.ProductWhereInput = {};
    const now = new Date();

    if (query.active !== undefined) {
      where.active = query.active;
    }

    if (query.category) {
      where.category = { slug: query.category, active: true };
    }

    if (query.brand) {
      where.brand = { slug: query.brand, active: true };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { brand: { name: { contains: query.search, mode: 'insensitive' } } },
        { category: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    if (query.onCampaign) {
      where.campaignProducts = {
        some: {
          campaign: {
            active: true,
            startsAt: { lte: now },
            endsAt: { gte: now },
          },
        },
      };
    }

    if (query.inStock) {
      where.inventory = {
        is: {
          quantity: { gt: 0 },
        },
      };
    }

    const sort = query.sort ?? ProductSort.NEWEST;
    const needsPricePostProcess =
      Boolean(query.minPrice) ||
      Boolean(query.maxPrice) ||
      sort === ProductSort.PRICE_ASC ||
      sort === ProductSort.PRICE_DESC;

    const page = Number(query.page);
    const limit = Number(query.limit);

    if (sort === ProductSort.BEST_SELLING) {
      const grouped = await this.prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 200,
      });
      const productIds = grouped
        .map((row) => row.productId)
        .filter((id): id is string => Boolean(id));
      if (productIds.length === 0) {
        return buildPaginatedResponse([], 0, page, limit);
      }
      where.id = { in: productIds };
      const products = await this.prisma.product.findMany({
        where,
        include: productListInclude,
      });
      const orderMap = new Map(productIds.map((id, index) => [id, index]));
      products.sort(
        (a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999),
      );
      const enriched = await this.enrichList(products, viewer);
      const filtered = this.applyPriceFilters(enriched, query);
      const total = filtered.length;
      const items = filtered.slice((page - 1) * limit, page * limit);
      return buildPaginatedResponse(items, total, page, limit);
    }

    if (needsPricePostProcess) {
      const products = await this.prisma.product.findMany({
        where,
        include: productListInclude,
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      let enriched = await this.enrichList(products, viewer);
      enriched = this.applyPriceFilters(enriched, query);
      if (sort === ProductSort.PRICE_ASC) {
        enriched.sort((a, b) => this.priceValue(a) - this.priceValue(b));
      } else if (sort === ProductSort.PRICE_DESC) {
        enriched.sort((a, b) => this.priceValue(b) - this.priceValue(a));
      }
      const total = enriched.length;
      const items = enriched.slice((page - 1) * limit, page * limit);
      return buildPaginatedResponse(items, total, page, limit);
    }

    const orderBy = this.resolveOrderBy(sort);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productListInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const enriched = await this.enrichList(items, viewer);
    return buildPaginatedResponse(enriched, total, page, limit);
  }

  private applyPriceFilters(
    items: ProductListItemDto[],
    query: PublicProductQueryDto,
  ): ProductListItemDto[] {
    let result = items;
    if (query.inStock) {
      result = result.filter((item) => (item.stock?.quantity ?? 0) > 0);
    }
    if (query.minPrice) {
      const min = Number(query.minPrice);
      result = result.filter((item) => this.priceValue(item) >= min);
    }
    if (query.maxPrice) {
      const max = Number(query.maxPrice);
      result = result.filter((item) => this.priceValue(item) <= max);
    }
    if (query.onCampaign) {
      result = result.filter((item) => item.onCampaign);
    }
    return result;
  }

  private priceValue(item: ProductListItemDto): number {
    return item.price ? Number(item.price.amount) : Number.POSITIVE_INFINITY;
  }

  private async enrichList(
    items: ProductListRecord[],
    viewer: ProductViewerContext,
  ): Promise<ProductListItemDto[]> {
    const ids = items.map((item) => item.id);
    const [prices, retailPrices] = await Promise.all([
      this.priceService.resolvePricesForProducts(ids, viewer),
      this.priceService.resolvePricesForProducts(ids, {}),
    ]);

    return items.map((item) => {
      const price = prices.get(item.id) ?? null;
      const retail = retailPrices.get(item.id) ?? null;
      const compareAtPrice =
        price &&
        retail &&
        price.type !== 'RETAIL' &&
        retail.amount !== price.amount
          ? retail
          : null;
      return this.toListItem(item, { price, compareAtPrice });
    });
  }

  private resolveOrderBy(
    sort: ProductSort,
  ): Prisma.ProductOrderByWithRelationInput {
    switch (sort) {
      case ProductSort.NAME:
        return { name: 'asc' };
      case ProductSort.NAME_DESC:
        return { name: 'desc' };
      case ProductSort.RECOMMENDED:
      case ProductSort.NEWEST:
      default:
        return { createdAt: 'desc' };
    }
  }

  private ensureSinglePrimaryImage(images?: { isPrimary?: boolean }[]): void {
    if (!images || images.length === 0) {
      return;
    }
    const primaryCount = images.filter((image) => image.isPrimary).length;
    if (primaryCount > 1) {
      throw new BadRequestException('Only one primary image is allowed');
    }
  }

  private async ensureBrandAndCategory(
    brandId: string,
    categoryId: string,
  ): Promise<void> {
    const [brand, category] = await Promise.all([
      this.prisma.brand.findUnique({ where: { id: brandId } }),
      this.prisma.category.findUnique({ where: { id: categoryId } }),
    ]);

    if (!brand) {
      throw new BadRequestException('Invalid brand');
    }
    if (!category) {
      throw new BadRequestException('Invalid category');
    }
  }

  private async ensureUniqueFields(
    sku: string,
    slug: string,
    barcode: string | null | undefined,
    excludeId?: string,
  ): Promise<void> {
    const [skuConflict, slugConflict, barcodeConflict] = await Promise.all([
      this.prisma.product.findFirst({
        where: {
          sku,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      }),
      this.prisma.product.findFirst({
        where: {
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      }),
      barcode
        ? this.prisma.product.findFirst({
            where: {
              barcode,
              ...(excludeId ? { id: { not: excludeId } } : {}),
            },
          })
        : Promise.resolve(null),
    ]);

    if (skuConflict) {
      throw new ConflictException('Product SKU already exists');
    }
    if (slugConflict) {
      throw new ConflictException('Product slug already exists');
    }
    if (barcodeConflict) {
      throw new ConflictException('Product barcode already exists');
    }
  }
}
