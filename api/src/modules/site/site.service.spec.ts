import { NotFoundException } from '@nestjs/common';
import { SiteService } from './site.service';

describe('SiteService', () => {
  const prisma = {
    legalPage: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: SiteService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SiteService(prisma as never);
  });

  it('getLegalPage returns dto', async () => {
    prisma.legalPage.upsert.mockResolvedValue({});
    prisma.legalPage.findUnique.mockResolvedValue({
      slug: 'kvkk',
      title: 'KVKK',
      body: 'body',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const page = await service.getLegalPage('kvkk');
    expect(page.slug).toBe('kvkk');
    expect(page.title).toBe('KVKK');
    expect(page.body).toBe('body');
  });

  it('getLegalPage rejects unknown slug', async () => {
    await expect(service.getLegalPage('unknown')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updateLegalPage updates title/body', async () => {
    prisma.legalPage.upsert.mockResolvedValue({});
    prisma.legalPage.update.mockResolvedValue({
      slug: 'terms',
      title: 'Terms',
      body: 'updated',
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const page = await service.updateLegalPage('terms', {
      title: 'Terms',
      body: 'updated',
    });
    expect(page.body).toBe('updated');
    expect(prisma.legalPage.update).toHaveBeenCalled();
  });
});
