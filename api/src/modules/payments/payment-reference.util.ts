import { randomBytes } from 'crypto';

/**
 * Customer-facing bank description reference.
 * Format: FS-{orderNumber}-{shortCode} when orderNumber lacks FS- prefix,
 * otherwise {orderNumber}-{shortCode} (order numbers already start with FS-).
 */
export function buildPaymentReference(orderNumber: string): string {
  const shortCode = randomBytes(3).toString('hex').toUpperCase();
  const base = orderNumber.startsWith('FS-')
    ? orderNumber
    : `FS-${orderNumber}`;
  return `${base}-${shortCode}`;
}
