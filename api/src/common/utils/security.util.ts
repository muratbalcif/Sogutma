import { createHash, randomUUID } from 'crypto';

/**
 * Escape a CSV cell and neutralize Excel/Sheets formula injection
 * for cells starting with = + - @ or tab/CR.
 */
export function csvEscape(value: string): string {
  let safe = value ?? '';
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function newRequestId(): string {
  return randomUUID();
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
