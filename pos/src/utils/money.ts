import Decimal from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function money(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

/** Display: ₺1.250,50 */
export function formatTry(value: string | number | Decimal): string {
  const d = money(value).toFixed(2);
  const [intPart, frac] = d.split(".");
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `₺${withDots},${frac}`;
}

export function lineTotal(unitPrice: string, quantity: number): string {
  return money(unitPrice).mul(quantity).toFixed(2);
}

export function sumAmounts(values: Array<string | number>): string {
  return values
    .reduce((acc, v) => acc.add(money(v)), money(0))
    .toFixed(2);
}

export function amountsEqual(a: string | number, b: string | number): boolean {
  return money(a).equals(money(b));
}

/** Cart display total before backend recalculation. */
export function estimateCartTotal(
  lines: Array<{ unitPrice: string; quantity: number; lineDiscount?: string }>,
  cartDiscountAmount = "0",
): string {
  const gross = lines.reduce((acc, line) => {
    const lineGross = money(line.unitPrice).mul(line.quantity);
    const disc = money(line.lineDiscount ?? 0);
    return acc.add(Decimal.max(lineGross.sub(disc), 0));
  }, money(0));
  return Decimal.max(gross.sub(money(cartDiscountAmount)), 0).toFixed(2);
}
