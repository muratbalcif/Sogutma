import { ConflictException } from '@nestjs/common';
import { BrandsService } from './brands.service';

describe('BrandsService', () => {
  const prisma = {
    brand: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new BrandsService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('creates a brand', async () => {
    prisma.brand.findUnique.mockResolvedValue(null);
    prisma.brand.create.mockResolvedValue({
      id: 'b1',
      name: 'Arçelik',
      slug: 'arcelik',
      logo: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.create({ name: 'Arçelik', slug: 'arcelik' }),
    ).resolves.toMatchObject({ slug: 'arcelik' });
  });

  it('rejects duplicate slug', async () => {
    prisma.brand.findUnique.mockResolvedValue({ id: 'b1' });
    await expect(
      service.create({ name: 'Arçelik', slug: 'arcelik' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists only active brands publicly', async () => {
    prisma.brand.findMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'Daikin',
        slug: 'daikin',
        logo: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const brands = await service.findPublicAll();
    expect(prisma.brand.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    expect(brands).toHaveLength(1);
  });
});
