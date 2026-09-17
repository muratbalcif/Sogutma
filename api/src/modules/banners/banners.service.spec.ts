import { BannersService } from './banners.service';

describe('BannersService', () => {
  const prisma = {
    banner: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new BannersService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('lists only active valid banners ordered by sortOrder', async () => {
    prisma.banner.findMany.mockResolvedValue([
      {
        id: '1',
        title: 'A',
        subtitle: null,
        imageUrl: 'https://cdn.example.com/a.jpg',
        mobileImageUrl: null,
        linkType: 'NONE',
        linkValue: null,
        sortOrder: 0,
        active: true,
        startsAt: null,
        endsAt: null,
      },
    ]);

    const list = await service.listPublic();
    expect(list).toHaveLength(1);
    expect(prisma.banner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
    );
  });

  it('soft-deactivates on delete', async () => {
    prisma.banner.findUnique.mockResolvedValue({
      id: '1',
      title: 'A',
      subtitle: null,
      imageUrl: 'https://cdn.example.com/a.jpg',
      mobileImageUrl: null,
      linkType: 'NONE',
      linkValue: null,
      sortOrder: 0,
      active: true,
      startsAt: null,
      endsAt: null,
    });
    prisma.banner.update.mockResolvedValue({});
    await service.remove('1');
    expect(prisma.banner.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { active: false },
    });
  });
});
