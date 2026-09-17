import { apiRequest } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";
import { ordersService, paymentsService } from "@/services/admin-api.service";

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
    todayTransfers,
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
    paymentsService
      .listBankTransfers(1, 100, { status: "APPROVED" })
      .then((r) => {
        const sum = r.items
          .filter((item) => new Date(item.createdAt) >= today)
          .reduce((acc, item) => acc + Number(item.amount), 0);
        return sum.toFixed(2);
      })
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
    todayTransferAmount: todayTransfers,
    pendingOrders,
  };
}
