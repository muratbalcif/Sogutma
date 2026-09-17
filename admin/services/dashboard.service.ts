import { apiRequest } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";
import {
  campaignsService,
  couponsAdminService,
  inventoryService,
  ordersService,
  paymentsService,
  accountingService,
} from "@/services/admin-api.service";

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
  pendingBankTransfers: number | null;
  pendingPayments: number | null;
  paidPayments: number | null;
  todayTransferAmount: string | null;
  pendingOrders: number | null;
  criticalStock: number | null;
  activeCampaigns: number | null;
  activeCoupons: number | null;
  featuredProducts: number | null;
};

async function safeTotal(path: string): Promise<number | null> {
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
 * Never invents numbers — failed permission/request → null.
 */
export async function fetchDashboardTotals(): Promise<DashboardTotals> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    pendingBankTransfers,
    pendingPayments,
    paidPayments,
    pendingOrders,
    collectionSummary,
    criticalStock,
    activeCampaigns,
    activeCoupons,
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
    paymentsService
      .listBankTransfers(1, 1, { status: "PENDING" })
      .then((r) => r.meta.total)
      .catch(() => null),
    paymentsService
      .list(1, 1, { status: "PENDING" })
      .then((r) => r.meta.total)
      .catch(() => null),
    paymentsService
      .list(1, 1, { status: "PAID" })
      .then((r) => r.meta.total)
      .catch(() => null),
    ordersService
      .list(1, 1, { status: "PENDING" })
      .then((r) => r.meta.total)
      .catch(() => null),
    accountingService
      .collectionsSummary()
      .catch(() => null),
    inventoryService
      .critical()
      .then((rows) => rows.length)
      .catch(() => null),
    campaignsService
      .list()
      .then((rows) => rows.filter((c) => c.active).length)
      .catch(() => null),
    couponsAdminService
      .list()
      .then((rows) => rows.filter((c) => c.active).length)
      .catch(() => null),
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
    pendingBankTransfers,
    pendingPayments,
    paidPayments,
    todayTransferAmount: collectionSummary?.todayCollections ?? null,
    pendingOrders,
    criticalStock,
    activeCampaigns,
    activeCoupons,
    featuredProducts: null,
  };
}
