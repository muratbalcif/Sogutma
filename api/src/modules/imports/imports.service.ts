import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ImportJobStatus,
  ImportJobType,
  PriceType,
  Prisma,
} from '@prisma/client';
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { EnvironmentVariables } from '../../config/env.validation';
import { slugifyTr, uniqueSlug } from '../../common/utils/slug.util';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';

export type ProductImportRow = {
  rowNumber: number;
  sku?: string;
  barcode?: string;
  name?: string;
  description?: string;
  brand?: string;
  category?: string;
  vatRate?: string;
  retailPrice?: string;
  campaignPrice?: string;
  wholesalePrice?: string;
  corporatePrice?: string;
  stock?: string;
  minimumStock?: string;
  active?: string;
  slug?: string;
};

export type ValidatedProductRow = {
  rowNumber: number;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  vatRate: number;
  retailPrice: number | null;
  campaignPrice: number | null;
  wholesalePrice: number | null;
  corporatePrice: number | null;
  stock: number | null;
  minimumStock: number | null;
  active: boolean;
  slug: string;
  isUpdate: boolean;
  errors: string[];
};

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  private maxRows(): number {
    return this.config.get('MAX_IMPORT_ROWS', { infer: true }) ?? 5000;
  }

  private batchSize(): number {
    return this.config.get('IMPORT_BATCH_SIZE', { infer: true }) ?? 100;
  }

  parseSpreadsheet(buffer: Buffer, filename: string): Record<string, string>[] {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.csv')) {
      const records = parseCsv(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as Record<string, string>[];
      return records;
    }
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        defval: '',
        raw: false,
      });
    }
    throw new BadRequestException('Only CSV and XLSX files are supported');
  }

  async createProductImportPreview(input: {
    adminUserId: string;
    filename: string;
    buffer: Buffer;
  }) {
    const rows = this.parseSpreadsheet(input.buffer, input.filename);
    if (rows.length > this.maxRows()) {
      throw new BadRequestException(
        `Import exceeds MAX_IMPORT_ROWS (${this.maxRows()})`,
      );
    }

    const validated = await this.validateProductRows(rows);
    const valid = validated.filter((r) => r.errors.length === 0);
    const invalid = validated.filter((r) => r.errors.length > 0);

    const job = await this.prisma.importJob.create({
      data: {
        type: ImportJobType.PRODUCTS,
        filename: input.filename,
        status:
          invalid.length === 0 ? ImportJobStatus.READY : ImportJobStatus.READY,
        totalRows: validated.length,
        validRows: valid.length,
        invalidRows: invalid.length,
        newRows: valid.filter((r) => !r.isUpdate).length,
        updateRows: valid.filter((r) => r.isUpdate).length,
        createdBy: input.adminUserId,
        preview: {
          rows: validated.map((r) => ({
            rowNumber: r.rowNumber,
            sku: r.sku,
            name: r.name,
            brand: r.brandName,
            category: r.categoryName,
            retailPrice: r.retailPrice,
            stock: r.stock,
            isUpdate: r.isUpdate,
            errors: r.errors,
            status: r.errors.length ? 'INVALID' : 'VALID',
          })),
        },
        rows: {
          create: validated.map((r) => ({
            rowNumber: r.rowNumber,
            sku: r.sku || null,
            status: r.errors.length ? 'INVALID' : 'VALID',
            errors: r.errors,
            payload: r,
          })),
        },
      },
    });

    await this.audit.log({
      adminUserId: input.adminUserId,
      action: 'BULK_IMPORT_STARTED',
      entityType: 'ImportJob',
      entityId: job.id,
      metadata: {
        type: 'PRODUCTS',
        filename: input.filename,
        totalRows: validated.length,
        validRows: valid.length,
        invalidRows: invalid.length,
      },
    });

    return this.getJob(job.id);
  }

  async confirmProductImport(jobId: string, adminUserId: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId },
      include: { rows: true },
    });
    if (!job) {
      throw new NotFoundException('Import job not found');
    }
    if (job.type !== ImportJobType.PRODUCTS) {
      throw new BadRequestException('Job type is not PRODUCTS');
    }
    if (
      job.status !== ImportJobStatus.READY &&
      job.status !== ImportJobStatus.PARTIAL
    ) {
      throw new BadRequestException(`Job cannot run from status ${job.status}`);
    }

    await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: ImportJobStatus.PROCESSING,
        startedAt: new Date(),
      },
    });

    const validRows = job.rows
      .filter((r) => r.status === 'VALID' && r.payload)
      .map((r) => r.payload as unknown as ValidatedProductRow);

    let success = 0;
    let failed = 0;
    const batch = this.batchSize();

    for (let i = 0; i < validRows.length; i += batch) {
      const slice = validRows.slice(i, i + batch);
      for (const row of slice) {
        try {
          await this.upsertProductRow(row, adminUserId);
          success += 1;
        } catch {
          failed += 1;
          await this.prisma.importRowResult.updateMany({
            where: { jobId, rowNumber: row.rowNumber },
            data: {
              status: 'FAILED',
              errors: ['Import failed for this row'],
            },
          });
        }
      }
    }

    const status =
      failed === 0
        ? ImportJobStatus.COMPLETED
        : success === 0
          ? ImportJobStatus.FAILED
          : ImportJobStatus.PARTIAL;

    const updated = await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status,
        successRows: success,
        failedRows: failed + job.invalidRows,
        completedAt: new Date(),
      },
    });

    await this.audit.log({
      adminUserId,
      action: 'BULK_IMPORT_COMPLETED',
      entityType: 'ImportJob',
      entityId: jobId,
      metadata: { success, failed, status },
    });

    return updated;
  }

  private async upsertProductRow(
    row: ValidatedProductRow,
    adminUserId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { sku: row.sku },
      });
      let productId: string;
      if (existing) {
        await tx.product.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            barcode: row.barcode,
            description: row.description,
            brandId: row.brandId,
            categoryId: row.categoryId,
            vatRate: new Prisma.Decimal(row.vatRate),
            active: row.active,
            slug: row.slug,
          },
        });
        productId = existing.id;
      } else {
        const created = await tx.product.create({
          data: {
            sku: row.sku,
            barcode: row.barcode,
            name: row.name,
            slug: row.slug,
            description: row.description,
            brandId: row.brandId,
            categoryId: row.categoryId,
            vatRate: new Prisma.Decimal(row.vatRate),
            active: row.active,
            inventory: {
              create: {
                quantity: row.stock ?? 0,
                reservedQuantity: 0,
                minimumQuantity: row.minimumStock ?? 0,
              },
            },
          },
        });
        productId = created.id;
      }

      if (row.retailPrice != null) {
        await this.upsertPrice(
          tx,
          productId,
          PriceType.RETAIL,
          row.retailPrice,
        );
      }
      if (row.campaignPrice != null) {
        await this.upsertPrice(
          tx,
          productId,
          PriceType.CAMPAIGN,
          row.campaignPrice,
        );
      }
      if (row.wholesalePrice != null) {
        await this.upsertPrice(
          tx,
          productId,
          PriceType.WHOLESALE,
          row.wholesalePrice,
        );
      }
      if (row.corporatePrice != null) {
        await this.upsertPrice(
          tx,
          productId,
          PriceType.CORPORATE,
          row.corporatePrice,
        );
      }

      if (existing && row.stock != null) {
        const inv = await tx.inventory.findUnique({
          where: { productId },
        });
        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: {
              quantity: row.stock,
              minimumQuantity: row.minimumStock ?? inv.minimumQuantity,
            },
          });
        }
      } else if (existing && row.minimumStock != null) {
        await tx.inventory.update({
          where: { productId },
          data: { minimumQuantity: row.minimumStock },
        });
      }
    });

    await this.audit.log({
      adminUserId,
      action: row.isUpdate ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: row.sku,
      metadata: { source: 'BULK_IMPORT', sku: row.sku },
    });
  }

  private async upsertPrice(
    tx: Prisma.TransactionClient,
    productId: string,
    type: PriceType,
    price: number,
  ): Promise<void> {
    const existing = await tx.productPrice.findFirst({
      where: { productId, type, active: true },
    });
    if (existing) {
      await tx.productPrice.update({
        where: { id: existing.id },
        data: { price: new Prisma.Decimal(price), active: true },
      });
    } else {
      await tx.productPrice.create({
        data: {
          productId,
          type,
          price: new Prisma.Decimal(price),
          active: true,
        },
      });
    }
  }

  private async validateProductRows(
    rawRows: Record<string, string>[],
  ): Promise<ValidatedProductRow[]> {
    const brands = await this.prisma.brand.findMany({
      select: { id: true, name: true, slug: true },
    });
    const categories = await this.prisma.category.findMany({
      select: { id: true, name: true, slug: true },
    });
    const brandByKey = new Map<string, { id: string; name: string }>();
    for (const b of brands) {
      brandByKey.set(b.slug.toLowerCase(), b);
      brandByKey.set(b.name.toLowerCase(), b);
    }
    const categoryByKey = new Map<string, { id: string; name: string }>();
    for (const c of categories) {
      categoryByKey.set(c.slug.toLowerCase(), c);
      categoryByKey.set(c.name.toLowerCase(), c);
    }

    const skusInFile = new Set<string>();
    const result: ValidatedProductRow[] = [];

    for (let i = 0; i < rawRows.length; i += 1) {
      const raw = this.normalizeKeys(rawRows[i]);
      const rowNumber = i + 2; // header = 1
      const errors: string[] = [];
      const sku = (raw.sku ?? '').trim().toUpperCase();
      if (!sku) errors.push('SKU missing');
      if (sku && skusInFile.has(sku)) errors.push('SKU duplicate in file');
      if (sku) skusInFile.add(sku);

      const name = (raw.name ?? '').trim();
      if (!name) errors.push('Name missing');

      const brandKey = (raw.brand ?? '').trim().toLowerCase();
      const brand = brandByKey.get(brandKey);
      if (!brand) errors.push('Brand not found');

      const categoryKey = (raw.category ?? '').trim().toLowerCase();
      const category = categoryByKey.get(categoryKey);
      if (!category) errors.push('Category not found');

      const vatRate = this.parseNumber(raw.vatrate ?? raw.vatRate ?? '20');
      if (vatRate == null || vatRate < 0 || vatRate > 100) {
        errors.push('Invalid VAT');
      }

      const retailPrice = this.parseOptionalNumber(
        raw.retailprice ?? raw.retailPrice,
      );
      if (raw.retailprice || raw.retailPrice) {
        if (retailPrice == null || retailPrice < 0)
          errors.push('Invalid price');
      }
      const campaignPrice = this.parseOptionalNumber(
        raw.campaignprice ?? raw.campaignPrice,
      );
      if (
        (raw.campaignprice || raw.campaignPrice) &&
        (campaignPrice == null || campaignPrice < 0)
      ) {
        errors.push('Invalid campaign price');
      }
      const wholesalePrice = this.parseOptionalNumber(
        raw.wholesaleprice ?? raw.wholesalePrice,
      );
      if (
        (raw.wholesaleprice || raw.wholesalePrice) &&
        (wholesalePrice == null || wholesalePrice < 0)
      ) {
        errors.push('Invalid wholesale price');
      }
      const corporatePrice = this.parseOptionalNumber(
        raw.corporateprice ?? raw.corporatePrice,
      );
      if (
        (raw.corporateprice || raw.corporatePrice) &&
        (corporatePrice == null || corporatePrice < 0)
      ) {
        errors.push('Invalid corporate price');
      }

      const stock = this.parseOptionalInt(raw.stock);
      if (raw.stock && (stock == null || stock < 0))
        errors.push('Negative stock');
      const minimumStock = this.parseOptionalInt(
        raw.minimumstock ?? raw.minimumStock,
      );
      if (
        (raw.minimumstock || raw.minimumStock) &&
        (minimumStock == null || minimumStock < 0)
      ) {
        errors.push('Invalid minimum stock');
      }

      const active = this.parseBoolean(raw.active ?? 'true');
      if (active == null) errors.push('Invalid boolean');

      let slug = (raw.slug ?? '').trim().toLowerCase();
      if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        errors.push('Invalid slug');
      }
      if (!slug && name) {
        slug = slugifyTr(name);
      }

      const existing = sku
        ? await this.prisma.product.findUnique({ where: { sku } })
        : null;

      if (slug && !existing) {
        const slugTaken = await this.prisma.product.findUnique({
          where: { slug },
        });
        if (slugTaken) {
          slug = await uniqueSlug(slug, async (s) =>
            Boolean(
              await this.prisma.product.findUnique({ where: { slug: s } }),
            ),
          );
        }
      }

      result.push({
        rowNumber,
        sku,
        barcode: (raw.barcode ?? '').trim() || null,
        name,
        description: (raw.description ?? '').trim() || null,
        brandId: brand?.id ?? '',
        brandName: brand?.name ?? raw.brand ?? '',
        categoryId: category?.id ?? '',
        categoryName: category?.name ?? raw.category ?? '',
        vatRate: vatRate ?? 20,
        retailPrice,
        campaignPrice,
        wholesalePrice,
        corporatePrice,
        stock,
        minimumStock,
        active: active ?? true,
        slug,
        isUpdate: Boolean(existing),
        errors,
      });
    }

    return result;
  }

  async createPriceImportPreview(input: {
    adminUserId: string;
    filename: string;
    buffer: Buffer;
  }) {
    const rows = this.parseSpreadsheet(input.buffer, input.filename);
    if (rows.length > this.maxRows()) {
      throw new BadRequestException(
        `Import exceeds MAX_IMPORT_ROWS (${this.maxRows()})`,
      );
    }
    const validated: Array<{
      rowNumber: number;
      sku: string;
      priceType: PriceType | null;
      price: number | null;
      validFrom: string | null;
      validTo: string | null;
      errors: string[];
      isUpdate: boolean;
    }> = [];

    for (let i = 0; i < rows.length; i += 1) {
      const raw = this.normalizeKeys(rows[i]);
      const errors: string[] = [];
      const sku = (raw.sku ?? '').trim().toUpperCase();
      if (!sku) errors.push('SKU missing');
      const product = sku
        ? await this.prisma.product.findUnique({ where: { sku } })
        : null;
      if (sku && !product) errors.push('Product not found');
      const typeRaw = (raw.pricetype ?? raw.priceType ?? 'RETAIL')
        .trim()
        .toUpperCase();
      const priceType = Object.values(PriceType).includes(typeRaw as PriceType)
        ? (typeRaw as PriceType)
        : null;
      if (!priceType) errors.push('Invalid price type');
      const price = this.parseNumber(raw.price ?? '');
      if (price == null || price < 0) errors.push('Invalid price');
      const validFrom = (raw.validfrom ?? raw.validFrom ?? '').trim() || null;
      const validTo = (raw.validto ?? raw.validTo ?? '').trim() || null;
      if (validFrom && validTo && new Date(validFrom) > new Date(validTo)) {
        errors.push('validFrom > validTo');
      }
      validated.push({
        rowNumber: i + 2,
        sku,
        priceType,
        price,
        validFrom,
        validTo,
        errors,
        isUpdate: Boolean(product),
      });
    }

    const valid = validated.filter((r) => r.errors.length === 0);
    const job = await this.prisma.importJob.create({
      data: {
        type: ImportJobType.PRICES,
        filename: input.filename,
        status: ImportJobStatus.READY,
        totalRows: validated.length,
        validRows: valid.length,
        invalidRows: validated.length - valid.length,
        createdBy: input.adminUserId,
        preview: { rows: validated },
        rows: {
          create: validated.map((r) => ({
            rowNumber: r.rowNumber,
            sku: r.sku || null,
            status: r.errors.length ? 'INVALID' : 'VALID',
            errors: r.errors,
            payload: r,
          })),
        },
      },
    });
    await this.audit.log({
      adminUserId: input.adminUserId,
      action: 'BULK_PRICE_UPDATE',
      entityType: 'ImportJob',
      entityId: job.id,
      metadata: { phase: 'preview', total: validated.length },
    });
    return this.getJob(job.id);
  }

  async confirmPriceImport(jobId: string, adminUserId: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId },
      include: { rows: true },
    });
    if (!job || job.type !== ImportJobType.PRICES) {
      throw new NotFoundException('Price import job not found');
    }
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: ImportJobStatus.PROCESSING, startedAt: new Date() },
    });
    let success = 0;
    let failed = 0;
    for (const row of job.rows.filter((r) => r.status === 'VALID')) {
      const payload = row.payload as {
        sku: string;
        priceType: PriceType;
        price: number;
        validFrom: string | null;
        validTo: string | null;
      };
      try {
        const product = await this.prisma.product.findUnique({
          where: { sku: payload.sku },
        });
        if (!product) throw new Error('missing');
        await this.prisma.$transaction(async (tx) => {
          await this.upsertPrice(
            tx,
            product.id,
            payload.priceType,
            payload.price,
          );
          if (payload.validFrom || payload.validTo) {
            await tx.productPrice.updateMany({
              where: {
                productId: product.id,
                type: payload.priceType,
                active: true,
              },
              data: {
                validFrom: payload.validFrom
                  ? new Date(payload.validFrom)
                  : null,
                validTo: payload.validTo ? new Date(payload.validTo) : null,
              },
            });
          }
        });
        success += 1;
      } catch {
        failed += 1;
      }
    }
    const status =
      failed === 0
        ? ImportJobStatus.COMPLETED
        : success === 0
          ? ImportJobStatus.FAILED
          : ImportJobStatus.PARTIAL;
    const updated = await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status,
        successRows: success,
        failedRows: failed + job.invalidRows,
        completedAt: new Date(),
      },
    });
    await this.audit.log({
      adminUserId,
      action: 'BULK_PRICE_UPDATE',
      entityType: 'ImportJob',
      entityId: jobId,
      metadata: { phase: 'confirm', success, failed },
    });
    return updated;
  }

  async createStockImportPreview(input: {
    adminUserId: string;
    filename: string;
    buffer: Buffer;
  }) {
    const rows = this.parseSpreadsheet(input.buffer, input.filename);
    if (rows.length > this.maxRows()) {
      throw new BadRequestException(
        `Import exceeds MAX_IMPORT_ROWS (${this.maxRows()})`,
      );
    }
    const validated: Array<{
      rowNumber: number;
      sku: string;
      quantity: number | null;
      operation: 'SET' | 'INCREASE' | 'DECREASE' | null;
      reason: string;
      errors: string[];
    }> = [];

    for (let i = 0; i < rows.length; i += 1) {
      const raw = this.normalizeKeys(rows[i]);
      const errors: string[] = [];
      const sku = (raw.sku ?? '').trim().toUpperCase();
      if (!sku) errors.push('SKU missing');
      const product = sku
        ? await this.prisma.product.findUnique({
            where: { sku },
            include: { inventory: true },
          })
        : null;
      if (sku && !product) errors.push('Product not found');
      const quantity = this.parseOptionalInt(raw.quantity);
      if (quantity == null || quantity < 0) errors.push('Invalid quantity');
      const op = (raw.operation ?? 'SET').trim().toUpperCase();
      const operation =
        op === 'SET' || op === 'INCREASE' || op === 'DECREASE' ? op : null;
      if (!operation) errors.push('Invalid operation');
      if (operation === 'DECREASE' && product?.inventory && quantity != null) {
        const available =
          product.inventory.quantity - product.inventory.reservedQuantity;
        if (quantity > available) {
          errors.push('Decrease exceeds available stock');
        }
      }
      validated.push({
        rowNumber: i + 2,
        sku,
        quantity,
        operation,
        reason: (raw.reason ?? '').trim() || 'Bulk stock update',
        errors,
      });
    }

    const valid = validated.filter((r) => r.errors.length === 0);
    const job = await this.prisma.importJob.create({
      data: {
        type: ImportJobType.STOCK,
        filename: input.filename,
        status: ImportJobStatus.READY,
        totalRows: validated.length,
        validRows: valid.length,
        invalidRows: validated.length - valid.length,
        createdBy: input.adminUserId,
        preview: { rows: validated },
        rows: {
          create: validated.map((r) => ({
            rowNumber: r.rowNumber,
            sku: r.sku || null,
            status: r.errors.length ? 'INVALID' : 'VALID',
            errors: r.errors,
            payload: r,
          })),
        },
      },
    });
    await this.audit.log({
      adminUserId: input.adminUserId,
      action: 'BULK_STOCK_UPDATE',
      entityType: 'ImportJob',
      entityId: job.id,
      metadata: { phase: 'preview' },
    });
    return this.getJob(job.id);
  }

  async confirmStockImport(jobId: string, adminUserId: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId },
      include: { rows: true },
    });
    if (!job || job.type !== ImportJobType.STOCK) {
      throw new NotFoundException('Stock import job not found');
    }
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: ImportJobStatus.PROCESSING, startedAt: new Date() },
    });
    let success = 0;
    let failed = 0;
    for (const row of job.rows.filter((r) => r.status === 'VALID')) {
      const payload = row.payload as {
        sku: string;
        quantity: number;
        operation: 'SET' | 'INCREASE' | 'DECREASE';
        reason: string;
      };
      try {
        const product = await this.prisma.product.findUniqueOrThrow({
          where: { sku: payload.sku },
        });
        if (payload.operation === 'INCREASE') {
          await this.inventoryService.increaseStock(
            product.id,
            payload.quantity,
            { note: payload.reason, createdBy: adminUserId },
          );
        } else if (payload.operation === 'DECREASE') {
          await this.inventoryService.decreaseStock(
            product.id,
            payload.quantity,
            { note: payload.reason, createdBy: adminUserId },
          );
        } else {
          await this.inventoryService.adjustStock(
            product.id,
            payload.quantity,
            {
              note: payload.reason,
              createdBy: adminUserId,
            },
          );
        }
        success += 1;
      } catch {
        failed += 1;
      }
    }
    const status =
      failed === 0
        ? ImportJobStatus.COMPLETED
        : success === 0
          ? ImportJobStatus.FAILED
          : ImportJobStatus.PARTIAL;
    return this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status,
        successRows: success,
        failedRows: failed + job.invalidRows,
        completedAt: new Date(),
      },
    });
  }

  async getJob(id: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id },
      include: {
        rows: {
          orderBy: { rowNumber: 'asc' },
          take: 500,
        },
      },
    });
    if (!job) {
      throw new NotFoundException('Import job not found');
    }
    return job;
  }

  async listJobs(query: {
    page?: number;
    limit?: number;
    type?: ImportJobType;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = query.type ? { type: query.type } : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.importJob.count({ where }),
      this.prisma.importJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, items, page, limit };
  }

  exportErrorsCsv(job: {
    rows: Array<{ rowNumber: number; sku: string | null; errors: string[] }>;
  }): string {
    const lines = ['row,sku,error'];
    for (const row of job.rows) {
      if (!row.errors.length) continue;
      for (const err of row.errors) {
        lines.push(
          `${row.rowNumber},"${(row.sku ?? '').replace(/"/g, '""')}","${err.replace(/"/g, '""')}"`,
        );
      }
    }
    return lines.join('\n');
  }

  private normalizeKeys(row: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      out[
        key
          .trim()
          .toLowerCase()
          .replace(/[\s_]+/g, '')
      ] = String(value ?? '').trim();
      out[key.trim()] = String(value ?? '').trim();
    }
    return out;
  }

  private parseNumber(value: string): number | null {
    if (!value?.trim()) return null;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  private parseOptionalNumber(value?: string): number | null {
    if (!value?.trim()) return null;
    return this.parseNumber(value);
  }

  private parseOptionalInt(value?: string): number | null {
    if (!value?.trim()) return null;
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }

  private parseBoolean(value: string): boolean | null {
    const v = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'evet', 'aktif'].includes(v)) return true;
    if (['0', 'false', 'no', 'hayir', 'hayır', 'pasif'].includes(v))
      return false;
    return null;
  }
}
