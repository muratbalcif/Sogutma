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
  const audit = {
    log: jest.fn(),
  };

  let service: SiteService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SiteService(prisma as never, audit as never);
  });

  it('getLegalPage returns dto', async () => {
    prisma.legalPage.upsert.mockResolvedValue({});
    prisma.legalPage.findUnique.mockResolvedValue({
      slug: 'kvkk',
      title: 'KVKK',
      body: 'body',
      version: 1,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const page = await service.getLegalPage('kvkk');
    expect(page.slug).toBe('kvkk');
    expect(page.title).toBe('KVKK');
    expect(page.body).toBe('body');
    expect(page.version).toBe(1);
  });

  it('getLegalPage rejects unknown slug', async () => {
    await expect(service.getLegalPage('unknown')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updateLegalPage increments version and writes audit', async () => {
    prisma.legalPage.upsert.mockResolvedValue({});
    prisma.legalPage.findUnique.mockResolvedValue({
      id: 'lp1',
      slug: 'terms',
      title: 'Terms',
      body: 'old',
      version: 2,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    prisma.legalPage.update.mockResolvedValue({
      id: 'lp1',
      slug: 'terms',
      title: 'Terms',
      body: 'updated',
      version: 3,
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const page = await service.updateLegalPage(
      'terms',
      { title: 'Terms', body: 'updated' },
      'admin-user-1',
    );
    expect(page.body).toBe('updated');
    expect(page.version).toBe(3);
    expect(prisma.legalPage.update).toHaveBeenCalledWith({
      where: { slug: 'terms' },
      data: {
        title: 'Terms',
        body: 'updated',
        version: { increment: 1 },
      },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: 'admin-user-1',
        action: 'LEGAL_PAGE_UPDATED',
        entityType: 'LegalPage',
        entityId: 'lp1',
        metadata: expect.objectContaining({
          slug: 'terms',
          version: 3,
          previousVersion: 2,
        }),
      }),
    );
  });

  it('updateLegalPage skips version bump when content unchanged', async () => {
    prisma.legalPage.upsert.mockResolvedValue({});
    prisma.legalPage.findUnique.mockResolvedValue({
      id: 'lp1',
      slug: 'terms',
      title: 'Terms',
      body: 'same',
      version: 4,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const page = await service.updateLegalPage(
      'terms',
      { title: 'Terms', body: 'same' },
      'admin-user-1',
    );
    expect(page.version).toBe(4);
    expect(prisma.legalPage.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
