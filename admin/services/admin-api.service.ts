import { apiRequest } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";

export type AdminProduct = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  active: boolean;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
};

export const catalogService = {
  listProducts(page = 1, limit = 20) {
    return apiRequest<PaginatedResponse<AdminProduct>>(
      `/admin/products?page=${page}&limit=${limit}`,
    );
  },
  listCategories(page = 1, limit = 20) {
    return apiRequest<PaginatedResponse<{ id: string; name: string; slug: string; active: boolean }>>(
      `/admin/categories?page=${page}&limit=${limit}`,
    );
  },
  listBrands(page = 1, limit = 20) {
    return apiRequest<PaginatedResponse<{ id: string; name: string; slug: string; active: boolean }>>(
      `/admin/brands?page=${page}&limit=${limit}`,
    );
  },
};

export const ordersService = {
  list(page = 1, limit = 20, params?: { status?: string }) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (params?.status) query.set("status", params.status);
    return apiRequest<PaginatedResponse<AdminOrder>>(
      `/admin/orders?${query.toString()}`,
    );
  },
};

export const inventoryService = {
  list(page = 1, limit = 20) {
    return apiRequest<PaginatedResponse<{
      id: string;
      productId: string;
      quantity: number;
      reservedQuantity: number;
      availableQuantity: number;
    }>>(`/admin/inventory?page=${page}&limit=${limit}`);
  },
};

export const paymentsService = {
  list(page = 1, limit = 20, params?: { status?: string }) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (params?.status) query.set("status", params.status);
    return apiRequest<PaginatedResponse<{
      id: string;
      status: string;
      amount: string;
      currency: string;
      provider: string | null;
      method: string;
    }>>(`/admin/payments?${query.toString()}`);
  },
  listBankTransfers(
    page = 1,
    limit = 20,
    params?: { status?: string; search?: string },
  ) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    return apiRequest<PaginatedResponse<{
      id: string;
      status: string;
      amount: string;
      orderTotal?: string;
      amountMismatch?: boolean;
      referenceNumber: string | null;
      orderNumber?: string;
      customerName?: string;
      bankName?: string | null;
      createdAt: string;
      transferDate: string;
      note: string | null;
    }>>(`/admin/bank-transfers?${query.toString()}`);
  },
  getBankTransfer(id: string) {
    return apiRequest<{
      id: string;
      status: string;
      amount: string;
      orderTotal?: string;
      amountMismatch?: boolean;
      referenceNumber: string | null;
      orderNumber?: string;
      customerName?: string;
      bankName?: string | null;
      createdAt: string;
      transferDate: string;
      note: string | null;
      rejectionReason: string | null;
      adminNote: string | null;
    }>(`/admin/bank-transfers/${id}`);
  },
  approveBankTransfer(id: string, body: { adminNote?: string }) {
    return apiRequest(`/admin/bank-transfers/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  rejectBankTransfer(
    id: string,
    body: { rejectionReason: string; adminNote?: string },
  ) {
    return apiRequest(`/admin/bank-transfers/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

export const accountingService = {
  listTransactions(page = 1, limit = 20) {
    return apiRequest<PaginatedResponse<{
      id: string;
      type: string;
      amount: string;
      createdAt: string;
    }>>(`/admin/accounting/transactions?page=${page}&limit=${limit}`);
  },
};

export const campaignsService = {
  list() {
    return apiRequest<Array<{
      id: string;
      name: string;
      slug: string;
      active: boolean;
      startsAt: string;
      endsAt: string;
    }>>("/admin/campaigns");
  },
};

export const bannersService = {
  list() {
    return apiRequest<Array<{
      id: string;
      title: string;
      active: boolean;
      sortOrder: number;
    }>>("/admin/banners");
  },
};

export const notificationsService = {
  list(page = 1, limit = 20) {
    return apiRequest<PaginatedResponse<{
      id: string;
      type: string;
      title: string;
      createdAt: string;
    }>>(`/admin/notifications?page=${page}&limit=${limit}`);
  },
};
