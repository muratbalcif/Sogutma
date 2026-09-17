import { CampaignType, Prisma } from '@prisma/client';

export type CampaignOfferInput = {
  campaignId: string;
  campaignType: CampaignType;
  priority: number;
  discountPercentage: Prisma.Decimal | null;
  discountAmount: Prisma.Decimal | null;
  specialPrice: Prisma.Decimal | null;
};

/**
 * Applies a campaign offer to a tax-inclusive retail base price.
 * Fixed-amount rule: if discount >= base, final price is 0.00 (never negative).
 */
export function applyCampaignOffer(
  basePrice: Prisma.Decimal,
  offer: CampaignOfferInput,
): Prisma.Decimal {
  switch (offer.campaignType) {
    case CampaignType.PERCENTAGE: {
      const pct = offer.discountPercentage ?? new Prisma.Decimal(0);
      const discount = basePrice.mul(pct).div(100);
      const result = basePrice.sub(discount);
      return result.lessThan(0)
        ? new Prisma.Decimal(0)
        : result.toDecimalPlaces(2);
    }
    case CampaignType.FIXED_AMOUNT: {
      const amount = offer.discountAmount ?? new Prisma.Decimal(0);
      const result = basePrice.sub(amount);
      return result.lessThan(0)
        ? new Prisma.Decimal(0)
        : result.toDecimalPlaces(2);
    }
    case CampaignType.SPECIAL_PRICE: {
      const special = offer.specialPrice ?? basePrice;
      return special.lessThan(0)
        ? new Prisma.Decimal(0)
        : special.toDecimalPlaces(2);
    }
    default:
      return basePrice.toDecimalPlaces(2);
  }
}

/**
 * Deterministic selection among active campaign offers:
 * 1. Higher priority wins
 * 2. On tie, lower effective price wins
 * 3. On further tie, lower campaignId wins
 */
export function selectBestCampaignOffer(
  basePrice: Prisma.Decimal,
  offers: CampaignOfferInput[],
): { offer: CampaignOfferInput; price: Prisma.Decimal } | null {
  if (offers.length === 0) {
    return null;
  }

  let best: { offer: CampaignOfferInput; price: Prisma.Decimal } | null = null;
  for (const offer of offers) {
    const price = applyCampaignOffer(basePrice, offer);
    if (!best) {
      best = { offer, price };
      continue;
    }
    if (offer.priority > best.offer.priority) {
      best = { offer, price };
      continue;
    }
    if (offer.priority < best.offer.priority) {
      continue;
    }
    if (price.lessThan(best.price)) {
      best = { offer, price };
      continue;
    }
    if (price.equals(best.price) && offer.campaignId < best.offer.campaignId) {
      best = { offer, price };
    }
  }
  return best;
}
