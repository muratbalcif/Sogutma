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
  list(page = 1, limit = 20) {
    return apiRequest<PaginatedResponse<AdminOrder>>(
      `/admin/orders?page=${page}&limit=${limit}`,
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
  list(page = 1, limit = 20) {
    return apiRequest<PaginatedResponse<{
      id: string;
      status: string;
      amount: string;
      currency: string;
      provider: string;
    }>>(`/admin/payments?page=${page}&limit=${limit}`);
  },
  listBankTransfers(page = 1, limit = 20) {
    return apiRequest<PaginatedResponse<{
      id: string;
      status: string;
      amount: string;
      referenceNumber: string | null;
    }>>(`/admin/bank-transfers?page=${page}&limit=${limit}`);
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
