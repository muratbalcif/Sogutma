import { Prisma } from '@prisma/client';

export function toMoneyString(value: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(value).toFixed(2);
}

export function assertNonNegativeMoney(value: Prisma.Decimal): void {
  if (value.lessThan(0)) {
    throw new Error('Price cannot be negative');
  }
}

export function multiplyMoney(
  unitPrice: Prisma.Decimal | string,
  quantity: number,
): Prisma.Decimal {
  return new Prisma.Decimal(unitPrice).mul(quantity);
}

export function sumMoney(
  values: Array<Prisma.Decimal | string>,
): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (acc, value) => acc.add(new Prisma.Decimal(value)),
    new Prisma.Decimal(0),
  );
}

/**
 * Storefront prices are tax-inclusive (KDV dahil).
 * Extracts the VAT portion from a gross (inclusive) amount.
 * tax = gross * vatRate / (100 + vatRate)
 */
export function extractInclusiveTax(
  grossInclusive: Prisma.Decimal | string,
  vatRatePercent: Prisma.Decimal | string | number,
): Prisma.Decimal {
  const gross = new Prisma.Decimal(grossInclusive);
  const rate = new Prisma.Decimal(vatRatePercent);
  if (rate.lessThanOrEqualTo(0)) {
    return new Prisma.Decimal(0);
  }
  return gross.mul(rate).div(rate.add(100)).toDecimalPlaces(2);
}
