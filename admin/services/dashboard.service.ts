import { apiRequest } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";

export type DashboardTotals = {
  products: number | null;
  orders: number | null;
  payments: number | null;
  inventory: number | null;
  campaigns: number | null;
  banners: number | null;
  notifications: number | null;
  bankTransfers: number | null;
  accountingTransactions: number | null;
};

async function safeTotal(
  path: string,
): Promise<number | null> {
  try {
    const data = await apiRequest<PaginatedResponse<unknown>>(path);
    return data.meta.total;
  } catch {
    return null;
  }
}

async function safeLength(path: string): Promise<number | null> {
  try {
    const data = await apiRequest<unknown[]>(path);
    return Array.isArray(data) ? data.length : null;
  } catch {
    return null;
  }
}

/**
 * Aggregates real counts from existing admin list endpoints.
 * Uses limit=1 where pagination meta.total is available.
 * Never invents numbers — failed permission/request → null.
 */
export async function fetchDashboardTotals(): Promise<DashboardTotals> {
  const [
    products,
    orders,
    payments,
    inventory,
    campaigns,
    banners,
    notifications,
    bankTransfers,
    accountingTransactions,
  ] = await Promise.all([
    safeTotal("/admin/products?page=1&limit=1"),
    safeTotal("/admin/orders?page=1&limit=1"),
    safeTotal("/admin/payments?page=1&limit=1"),
    safeTotal("/admin/inventory?page=1&limit=1"),
    safeLength("/admin/campaigns"),
    safeLength("/admin/banners"),
    safeTotal("/admin/notifications?page=1&limit=1"),
    safeTotal("/admin/bank-transfers?page=1&limit=1"),
    safeTotal("/admin/accounting/transactions?page=1&limit=1"),
  ]);

  return {
    products,
    orders,
    payments,
    inventory,
    campaigns,
    banners,
    notifications,
    bankTransfers,
    accountingTransactions,
  };
}
