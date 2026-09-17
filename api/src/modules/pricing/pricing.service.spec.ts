import { BadRequestException } from '@nestjs/common';
import { PriceType, Prisma, UserType } from '@prisma/client';
import { PriceService } from './pricing.service';

describe('PriceService', () => {
  const prisma = {
    product: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    productPrice: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    customerPrice: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const campaignsService = {
    resolveCampaignPrice: jest.fn().mockResolvedValue(null),
  };

  const service = new PriceService(prisma as never, campaignsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.user.findUnique.mockResolvedValue({ id: 'c1' });
    campaignsService.resolveCampaignPrice.mockResolvedValue(null);
  });

  it('resolves retail price for anonymous users', async () => {
    prisma.productPrice.findFirst
      .mockResolvedValueOnce({
        type: PriceType.RETAIL,
        price: new Prisma.Decimal('1000.00'),
        currency: 'TRY',
      })
      .mockResolvedValueOnce(null); // legacy campaign

    const price = await service.resolvePrice('p1');
    expect(price).toEqual({
      amount: '1000.00',
      currency: 'TRY',
      type: PriceType.RETAIL,
    });
  });

  it('prefers campaign over retail', async () => {
    prisma.productPrice.findFirst
      .mockResolvedValueOnce({
        type: PriceType.RETAIL,
        price: new Prisma.Decimal('1000.00'),
        currency: 'TRY',
      })
      .mockResolvedValueOnce({
        type: PriceType.CAMPAIGN,
        price: new Prisma.Decimal('900.00'),
        currency: 'TRY',
      });

    const price = await service.resolvePrice('p1');
    expect(price?.amount).toBe('900.00');
    expect(price?.type).toBe(PriceType.CAMPAIGN);
  });

  it('uses campaign module price when better', async () => {
    prisma.productPrice.findFirst
      .mockResolvedValueOnce({
        type: PriceType.RETAIL,
        price: new Prisma.Decimal('1000.00'),
        currency: 'TRY',
      })
      .mockResolvedValueOnce(null);
    campaignsService.resolveCampaignPrice.mockResolvedValue({
      amount: new Prisma.Decimal('850.00'),
      campaignId: 'camp-1',
    });

    const price = await service.resolvePrice('p1');
    expect(price?.amount).toBe('850.00');
    expect(price?.type).toBe(PriceType.CAMPAIGN);
  });

  it('prefers corporate then wholesale for corporate users', async () => {
    prisma.customerPrice.findFirst.mockResolvedValue(null);
    prisma.productPrice.findFirst.mockResolvedValueOnce({
      type: PriceType.CORPORATE,
      price: new Prisma.Decimal('750.00'),
      currency: 'TRY',
    });

    const price = await service.resolvePrice('p1', {
      userType: UserType.CORPORATE,
      customerId: 'c1',
    });
    expect(price?.amount).toBe('750.00');
    expect(price?.type).toBe(PriceType.CORPORATE);
  });

  it('customer-specific price overrides all', async () => {
    prisma.customerPrice.findFirst.mockResolvedValue({
      price: new Prisma.Decimal('700.00'),
      currency: 'TRY',
    });

    const price = await service.resolvePrice('p1', {
      customerId: 'c1',
      userType: UserType.INDIVIDUAL,
    });
    expect(price).toEqual({
      amount: '700.00',
      currency: 'TRY',
      type: 'CUSTOMER',
    });
    expect(prisma.productPrice.findFirst).not.toHaveBeenCalled();
  });

  it('rejects negative prices', async () => {
    await expect(
      service.createProductPrice('p1', {
        type: PriceType.RETAIL,
        price: '-1.00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
