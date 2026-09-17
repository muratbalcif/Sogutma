import { BadRequestException, ConflictException } from '@nestjs/common';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  const prisma = {
    category: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new CategoriesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a category', async () => {
    prisma.category.findUnique.mockResolvedValueOnce(null);
    prisma.category.create.mockResolvedValue({
      id: 'c1',
      parentId: null,
      name: 'Klima',
      slug: 'klima',
      image: null,
      sortOrder: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create({
      name: 'Klima',
      slug: 'klima',
    });

    expect(result.slug).toBe('klima');
  });

  it('rejects duplicate slug', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'c1', slug: 'klima' });

    await expect(
      service.create({ name: 'Klima', slug: 'klima' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects self-parent on update', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      slug: 'klima',
      parentId: null,
    });

    await expect(
      service.update('c1', { parentId: 'c1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('builds nested public tree and excludes inactive', async () => {
    prisma.category.findMany.mockResolvedValue([
      {
        id: 'p1',
        parentId: null,
        name: 'Klima',
        slug: 'klima',
        image: null,
        sortOrder: 1,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'c1',
        parentId: 'p1',
        name: 'Split Klima',
        slug: 'split-klima',
        image: null,
        sortOrder: 1,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const tree = await service.findPublicTree();
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].slug).toBe('split-klima');
  });
});
