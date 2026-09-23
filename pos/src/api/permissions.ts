import type { AuthUser } from "../types/api";

export function canUsePos(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.roles.includes("SUPER_ADMIN")) return true;
  if (user.roles.includes("POS_CASHIER")) return true;
  return user.permissions.includes("pos.sell");
}

export function canDiscount(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.roles.includes("SUPER_ADMIN")) return true;
  return user.permissions.includes("pos.discount");
}

export function canRefund(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.roles.includes("SUPER_ADMIN")) return true;
  return user.permissions.includes("pos.refund");
}
