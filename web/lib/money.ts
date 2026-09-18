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

/**
 * Normalize user-entered money to API decimal string (`18000.00`).
 * Accepts tr-TR (`18.000,50`) and plain (`18000` / `18000.5`) inputs.
 */
export function toApiMoneyAmount(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return null;

  let normalized = trimmed;
  if (trimmed.includes(",") && trimmed.includes(".")) {
    const lastComma = trimmed.lastIndexOf(",");
    const lastDot = trimmed.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = trimmed.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = trimmed.replace(/,/g, "");
    }
  } else if (trimmed.includes(",")) {
    const parts = trimmed.split(",");
    if (parts.length === 2 && parts[1]!.length <= 2) {
      normalized = `${parts[0]!.replace(/\./g, "")}.${parts[1]}`;
    } else {
      normalized = trimmed.replace(/,/g, "");
    }
  } else if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, "");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value.toFixed(2);
}

export function shouldShowCompareAt(
  amount: string,
  compareAt?: string | null,
): boolean {
  if (!compareAt) return false;
  return Number(compareAt) > Number(amount);
}
