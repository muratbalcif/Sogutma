/** Display-only money formatting. Never use for calculations. */
export function formatMoney(
  amount: string,
  currency = "TRY",
  locale = "tr-TR",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

export function shouldShowCompareAt(
  amount: string,
  compareAt?: string | null,
): boolean {
  if (!compareAt) return false;
  return Number(compareAt) > Number(amount);
}
