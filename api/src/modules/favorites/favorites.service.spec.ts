import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  const prisma = {
    product: { findUnique: jest.fn() },
    favorite: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const service = new FavoritesService(prisma as never);
  const userId = 'user-1';
  const productId = 'product-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds a favorite for an active product', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: productId,
      active: true,
    });
    prisma.favorite.upsert.mockResolvedValue({
      id: 'fav-1',
      productId,
      createdAt: new Date('2026-01-01'),
      product: {
        id: productId,
        name: 'Compressor',
        slug: 'compressor',
        sku: 'SKU-1',
        images: [],
      },
    });

    const favorite = await service.add(userId, productId);
    expect(favorite.productId).toBe(productId);
    expect(prisma.favorite.upsert).toHaveBeenCalled();
  });

  it('handles duplicate favorites via upsert', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: productId,
      active: true,
    });
    prisma.favorite.upsert.mockResolvedValue({
      id: 'fav-1',
      productId,
      createdAt: new Date('2026-01-01'),
      product: {
        id: productId,
        name: 'Compressor',
        slug: 'compressor',
        sku: 'SKU-1',
        images: [],
      },
    });

    await service.add(userId, productId);
    await service.add(userId, productId);
    expect(prisma.favorite.upsert).toHaveBeenCalledTimes(2);
  });

  it('lists favorites for the user', async () => {
    prisma.favorite.findMany.mockResolvedValue([
      {
        id: 'fav-1',
        productId,
        createdAt: new Date('2026-01-01'),
        product: {
          id: productId,
          name: 'Compressor',
          slug: 'compressor',
          sku: 'SKU-1',
          images: [],
        },
      },
    ]);

    const list = await service.list(userId);
    expect(list).toHaveLength(1);
    expect(prisma.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId } }),
    );
  });

  it('removes favorites idempotently', async () => {
    prisma.favorite.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove(userId, productId)).resolves.toEqual({
      success: true,
    });
  });

  it('checks favorite status', async () => {
    prisma.favorite.findUnique.mockResolvedValue({ id: 'fav-1' });
    await expect(service.check(userId, productId)).resolves.toEqual({
      productId,
      isFavorite: true,
    });
  });

  it('rejects inactive products', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: productId,
      active: false,
    });
    await expect(service.add(userId, productId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects missing products', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(service.add(userId, productId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
