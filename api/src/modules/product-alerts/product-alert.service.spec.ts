import { NotFoundException } from '@nestjs/common';
import { ProductAlertService } from './product-alert.service';

describe('ProductAlertService', () => {
  const prisma = {
    product: { findUnique: jest.fn() },
    productAlert: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const service = new ProductAlertService(prisma as never);
  const userId = 'user-1';
  const productId = 'product-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a product alert', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: productId,
      name: 'Compressor',
      slug: 'compressor',
      sku: 'SKU-1',
    });
    prisma.productAlert.upsert.mockResolvedValue({
      id: 'alert-1',
      productId,
      active: true,
      triggeredAt: null,
      createdAt: new Date('2026-01-01'),
      product: {
        id: productId,
        name: 'Compressor',
        slug: 'compressor',
        sku: 'SKU-1',
      },
    });

    const alert = await service.createAlert(userId, productId);
    expect(alert.active).toBe(true);
    expect(alert.productId).toBe(productId);
  });

  it('handles duplicate alerts by reactivating the same row', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: productId,
      name: 'Compressor',
      slug: 'compressor',
      sku: 'SKU-1',
    });
    prisma.productAlert.upsert.mockResolvedValue({
      id: 'alert-1',
      productId,
      active: true,
      triggeredAt: null,
      createdAt: new Date('2026-01-01'),
      product: {
        id: productId,
        name: 'Compressor',
        slug: 'compressor',
        sku: 'SKU-1',
      },
    });

    await service.createAlert(userId, productId);
    expect(prisma.productAlert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { active: true, triggeredAt: null },
      }),
    );
  });

  it('lists user alerts', async () => {
    prisma.productAlert.findMany.mockResolvedValue([]);
    await service.getUserAlerts(userId);
    expect(prisma.productAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId } }),
    );
  });

  it('removes alerts idempotently', async () => {
    prisma.productAlert.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.removeAlert(userId, productId)).resolves.toEqual({
      success: true,
    });
  });

  it('finds eligible alert candidates', async () => {
    prisma.productAlert.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);
    await expect(service.findTriggeredCandidates(productId)).resolves.toEqual([
      'user-1',
      'user-2',
    ]);
    expect(prisma.productAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId,
          active: true,
          triggeredAt: null,
        },
      }),
    );
  });

  it('triggers alerts once and does not re-trigger inactive ones', async () => {
    prisma.productAlert.findMany.mockResolvedValue([{ userId: 'user-1' }]);
    prisma.productAlert.updateMany.mockResolvedValue({ count: 1 });

    const first = await service.triggerAlert(productId);
    expect(first.triggeredCount).toBe(1);

    prisma.productAlert.findMany.mockResolvedValue([]);
    const second = await service.triggerAlert(productId);
    expect(second.triggeredCount).toBe(0);
    expect(prisma.productAlert.updateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects missing products', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(service.createAlert(userId, productId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
