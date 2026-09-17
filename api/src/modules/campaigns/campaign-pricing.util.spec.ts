import { CampaignType, Prisma } from '@prisma/client';
import {
  applyCampaignOffer,
  selectBestCampaignOffer,
} from './campaign-pricing.util';

describe('campaign-pricing.util', () => {
  const base = new Prisma.Decimal('1000.00');

  it('applies percentage discount with Decimal precision', () => {
    const price = applyCampaignOffer(base, {
      campaignId: 'c1',
      campaignType: CampaignType.PERCENTAGE,
      priority: 0,
      discountPercentage: new Prisma.Decimal('10'),
      discountAmount: null,
      specialPrice: null,
    });
    expect(price.toFixed(2)).toBe('900.00');
  });

  it('applies fixed amount and never goes negative', () => {
    const price = applyCampaignOffer(base, {
      campaignId: 'c1',
      campaignType: CampaignType.FIXED_AMOUNT,
      priority: 0,
      discountPercentage: null,
      discountAmount: new Prisma.Decimal('1500'),
      specialPrice: null,
    });
    expect(price.toFixed(2)).toBe('0.00');
  });

  it('applies special price', () => {
    const price = applyCampaignOffer(base, {
      campaignId: 'c1',
      campaignType: CampaignType.SPECIAL_PRICE,
      priority: 0,
      discountPercentage: null,
      discountAmount: null,
      specialPrice: new Prisma.Decimal('799.90'),
    });
    expect(price.toFixed(2)).toBe('799.90');
  });

  it('selects higher priority then lower price deterministically', () => {
    const best = selectBestCampaignOffer(base, [
      {
        campaignId: 'a',
        campaignType: CampaignType.PERCENTAGE,
        priority: 1,
        discountPercentage: new Prisma.Decimal('5'),
        discountAmount: null,
        specialPrice: null,
      },
      {
        campaignId: 'b',
        campaignType: CampaignType.SPECIAL_PRICE,
        priority: 2,
        discountPercentage: null,
        discountAmount: null,
        specialPrice: new Prisma.Decimal('950.00'),
      },
    ]);
    expect(best?.offer.campaignId).toBe('b');
    expect(best?.price.toFixed(2)).toBe('950.00');
  });
});
