import { apiDownloadBlob, apiRequest } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";

export type AdminProduct = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  slug: string;
  description: string | null;
  vatRate: string;
  active: boolean;
  isFeatured?: boolean;
  featuredSortOrder?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
  createdAt: string;
  updatedAt: string;
  brand: { id: string; name: string; slug: string; logo: string | null; active: boolean };
  category: { id: string; name: string; slug: string };
  images: Array<{
    id: string;
    url: string;
    objectKey?: string | null;
    alt: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }>;
  attributes?: Array<{ id: string; name: string; value: string; sortOrder: number }>;
  compatibility?: Array<{
    id: string;
    manufacturer: string;
    model: string;
    modelYear: number | null;
    notes: string | null;
  }>;
  technicalHtml?: string | null;
  compatibilityHtml?: string | null;
  price?: { amount: string; type: string; currency: string } | null;
  stock?: {
    quantity: number;
    reservedQuantity?: number;
    availableQuantity?: number;
    available?: boolean;
  };
};

export type AdminImportJob = {
  id: string;
  type: string;
  filename: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  successRows: number;
  failedRows: number;
  newRows: number;
  updateRows: number;
  preview?: unknown;
  errorSummary?: string | null;
  createdBy: string;
  createdAt: string;
  completedAt?: string | null;
  rowResults?: Array<{
    rowNumber: number;
    sku: string | null;
    status: string;
    errors: string[];
  }>;
};

export type AdminAuditLog = {
  id: string;
  adminUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
};

export type AdminOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export type AdminPaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED";

export type AdminOrderCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
};

export type AdminOrderPayment = {
  id: string;
  status: AdminPaymentStatus | string;
  method: string;
  amount: string;
  currency: string;
  provider: string | null;
  expiresAt: string | null;
  approvedTotal?: string;
  remainingAmount?: string;
};

export type AdminPayment = {
  id: string;
  orderId: string;
  method: string;
  status: AdminPaymentStatus | string;
  amount: string;
  currency: string;
  provider: string | null;
  providerPaymentId: string | null;
  idempotencyKey: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  pendingBankTransferId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminBankAccount = {
  id: string;
  bankName: string;
  accountName: string;
  iban: string;
  branch: string | null;
  accountNumber?: string | null;
  currency: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
};

export type AdminOrderShipping = {
  id: string;
  orderId: string;
  provider: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderStatusHistory = {
  id: string;
  fromStatus: AdminOrderStatus | string | null;
  toStatus: AdminOrderStatus | string;
  note: string | null;
  changedBy: string | null;
  createdAt: string;
};

export type AdminOrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  subtotal: string;
  totalAmount: string;
};

export type AdminOrderReturn = {
  id: string;
  returnReason: string | null;
  adminNote: string | null;
  createdAt: string;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  status: AdminOrderStatus | string;
  currency: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  shippingAmount: string;
  totalAmount: string;
  customerNote: string | null;
  shippingAddress?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  items: AdminOrderItem[];
  statusHistory: AdminOrderStatusHistory[];
  payment: AdminOrderPayment | null;
  shipping: AdminOrderShipping | null;
  customer?: AdminOrderCustomer;
  orderReturn?: AdminOrderReturn | null;
  allowedTransitions: Array<AdminOrderStatus | string>;
  canCancel: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderListParams = {
  status?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: "createdAt" | "totalAmount" | "orderNumber";
  sortOrder?: "asc" | "desc";
};

export const catalogService = {
  listProducts(
    page = 1,
    limit = 20,
    params?: { search?: string; active?: boolean; sort?: string },
  ) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (params?.search) query.set("search", params.search);
    if (params?.active !== undefined) query.set("active", String(params.active));
    if (params?.sort) query.set("sort", params.sort);
    return apiRequest<PaginatedResponse<AdminProduct>>(
      `/admin/products?${query.toString()}`,
    );
  },
  getProduct(id: string) {
    return apiRequest<AdminProduct>(`/admin/products/${id}`);
  },
  createProduct(body: Record<string, unknown>) {
    return apiRequest<AdminProduct>("/admin/products", {
      method: "POST",
      body,
    });
  },
  updateProduct(id: string, body: Record<string, unknown>) {
    return apiRequest<AdminProduct>(`/admin/products/${id}`, {
      method: "PATCH",
      body,
    });
  },
  deleteProduct(id: string) {
    return apiRequest<AdminProduct>(`/admin/products/${id}`, {
      method: "DELETE",
    });
  },
  bulkStatus(productIds: string[], active: boolean) {
    return apiRequest<{ updated: number }>("/admin/products/bulk-status", {
      method: "POST",
      body: { productIds, active },
    });
  },
  presignUpload(body: {
    filename: string;
    contentType: string;
    folder?: string;
    contentLength: number;
  }) {
    return apiRequest<{
      uploadUrl: string;
      objectKey: string;
      publicUrl: string;
      maxBytes: number;
    }>("/admin/uploads/presign", { method: "POST", body });
  },
  registerImage(
    productId: string,
    body: {
      url: string;
      objectKey?: string;
      alt?: string;
      isPrimary?: boolean;
    },
  ) {
    return apiRequest(`/admin/products/${productId}/images`, {
      method: "POST",
      body,
    });
  },
  deleteImage(productId: string, imageId: string) {
    return apiRequest(`/admin/products/${productId}/images/${imageId}`, {
      method: "DELETE",
    });
  },
  setPrimaryImage(productId: string, imageId: string) {
    return apiRequest(
      `/admin/products/${productId}/images/${imageId}/primary`,
      { method: "POST" },
    );
  },
  listProductPrices(productId: string) {
    return apiRequest<
      Array<{
        id: string;
        productId: string;
        type: string;
        price: string;
        amount?: string;
        currency: string;
        validFrom: string | null;
        validTo: string | null;
        active: boolean;
      }>
    >(`/admin/pricing/products/${productId}`);
  },
  createProductPrice(
    productId: string,
    body: {
      type: string;
      price?: string;
      amount?: number | string;
      currency?: string;
      validFrom?: string;
      validTo?: string;
      active?: boolean;
    },
  ) {
    const price =
      body.price ??
      (body.amount !== undefined && body.amount !== ""
        ? String(body.amount)
        : undefined);
    return apiRequest(`/admin/pricing/products/${productId}`, {
      method: "POST",
      body: {
        type: body.type,
        price,
        currency: body.currency ?? "TRY",
        validFrom: body.validFrom || undefined,
        validTo: body.validTo || undefined,
        active: body.active ?? true,
      },
    });
  },
  updateProductPrice(
    priceId: string,
    body: {
      price?: string;
      currency?: string;
      validFrom?: string | null;
      validTo?: string | null;
      active?: boolean;
    },
  ) {
    return apiRequest(`/admin/pricing/${priceId}`, {
      method: "PATCH",
      body,
    });
  },
  deactivateProductPrice(priceId: string) {
    return apiRequest(`/admin/pricing/${priceId}`, { method: "DELETE" });
  },
  setFeatured(id: string, body: { isFeatured: boolean; featuredSortOrder?: number }) {
    return apiRequest(`/admin/products/${id}/featured`, {
      method: "POST",
      body,
    });
  },
  listCategories(page = 1, limit = 20) {
    return apiRequest<
      PaginatedResponse<{
        id: string;
        name: string;
        slug: string;
        active: boolean;
        parentId?: string | null;
        sortOrder?: number;
      }>
    >(`/admin/categories?page=${page}&limit=${limit}`);
  },
  createCategory(body: {
    name: string;
    slug: string;
    parentId?: string;
    image?: string;
    sortOrder?: number;
    active?: boolean;
  }) {
    return apiRequest<{
      id: string;
      name: string;
      slug: string;
      active: boolean;
      parentId?: string | null;
      sortOrder?: number;
    }>("/admin/categories", { method: "POST", body });
  },
  updateCategory(
    id: string,
    body: {
      name?: string;
      slug?: string;
      parentId?: string | null;
      image?: string | null;
      sortOrder?: number;
      active?: boolean;
    },
  ) {
    return apiRequest<{
      id: string;
      name: string;
      slug: string;
      active: boolean;
      parentId?: string | null;
      sortOrder?: number;
    }>(`/admin/categories/${id}`, { method: "PATCH", body });
  },
  deleteCategory(id: string) {
    return apiRequest<{ id: string }>(`/admin/categories/${id}`, {
      method: "DELETE",
    });
  },
  listBrands(page = 1, limit = 20) {
    return apiRequest<
      PaginatedResponse<{
        id: string;
        name: string;
        slug: string;
        active: boolean;
        description?: string | null;
        sortOrder?: number;
      }>
    >(`/admin/brands?page=${page}&limit=${limit}`);
  },
  createBrand(body: {
    name: string;
    slug: string;
    logo?: string;
    description?: string;
    sortOrder?: number;
    active?: boolean;
  }) {
    return apiRequest<{
      id: string;
      name: string;
      slug: string;
      active: boolean;
      description?: string | null;
      sortOrder?: number;
    }>("/admin/brands", { method: "POST", body });
  },
  updateBrand(
    id: string,
    body: {
      name?: string;
      slug?: string;
      logo?: string | null;
      description?: string | null;
      sortOrder?: number;
      active?: boolean;
    },
  ) {
    return apiRequest<{
      id: string;
      name: string;
      slug: string;
      active: boolean;
      description?: string | null;
      sortOrder?: number;
    }>(`/admin/brands/${id}`, { method: "PATCH", body });
  },
  deleteBrand(id: string) {
    return apiRequest<{ id: string }>(`/admin/brands/${id}`, {
      method: "DELETE",
    });
  },
};

export const importsService = {
  list(page = 1, limit = 20, type?: string) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (type) query.set("type", type);
    return apiRequest<PaginatedResponse<AdminImportJob>>(
      `/admin/imports?${query.toString()}`,
    );
  },
  get(id: string) {
    return apiRequest<AdminImportJob>(`/admin/imports/${id}`);
  },
  previewProducts(file: File, mode = "upsert") {
    const form = new FormData();
    form.append("file", file);
    form.append("mode", mode);
    return apiRequest<AdminImportJob>("/admin/imports/products/preview", {
      method: "POST",
      body: form,
    });
  },
  confirm(id: string, type: "products" | "prices" | "stock" = "products") {
    return apiRequest<AdminImportJob>(`/admin/imports/${type}/${id}/confirm`, {
      method: "POST",
    });
  },
  previewPrices(file: File) {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<AdminImportJob>("/admin/imports/prices/preview", {
      method: "POST",
      body: form,
    });
  },
  previewStock(file: File) {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<AdminImportJob>("/admin/imports/stock/preview", {
      method: "POST",
      body: form,
    });
  },
  errorsCsvUrl(id: string) {
    const base =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";
    return `${base}/admin/imports/${id}/errors.csv`;
  },
};

export const auditService = {
  list(
    page = 1,
    limit = 20,
    params?: {
      adminUserId?: string;
      action?: string;
      entityType?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (params?.adminUserId) query.set("adminUserId", params.adminUserId);
    if (params?.action) query.set("action", params.action);
    if (params?.entityType) query.set("entityType", params.entityType);
    if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
    if (params?.dateTo) query.set("dateTo", params.dateTo);
    return apiRequest<PaginatedResponse<AdminAuditLog>>(
      `/admin/audit-logs?${query.toString()}`,
    );
  },
};

export const ordersService = {
  list(page = 1, limit = 20, params?: AdminOrderListParams) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (params?.status) query.set("status", params.status);
    if (params?.paymentStatus) query.set("paymentStatus", params.paymentStatus);
    if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
    if (params?.dateTo) query.set("dateTo", params.dateTo);
    if (params?.search) query.set("search", params.search);
    if (params?.sortBy) query.set("sortBy", params.sortBy);
    if (params?.sortOrder) query.set("sortOrder", params.sortOrder);
    return apiRequest<PaginatedResponse<AdminOrder>>(
      `/admin/orders?${query.toString()}`,
    );
  },
  getById(id: string) {
    return apiRequest<AdminOrder>(`/admin/orders/${id}`);
  },
  updateStatus(
    id: string,
    body: {
      status: string;
      note?: string;
      returnReason?: string;
      adminNote?: string;
    },
  ) {
    return apiRequest<AdminOrder>(`/admin/orders/${id}/status`, {
      method: "PATCH",
      body: body,
    });
  },
  ship(
    id: string,
    body: { trackingNumber: string; trackingUrl?: string; note?: string },
  ) {
    return apiRequest<AdminOrder>(`/admin/orders/${id}/ship`, {
      method: "POST",
      body: body,
    });
  },
  deliver(id: string, body?: { note?: string }) {
    return apiRequest<AdminOrder>(`/admin/orders/${id}/deliver`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  },
  startReturn(
    id: string,
    body?: { returnReason?: string; adminNote?: string },
  ) {
    return apiRequest<AdminOrder>(`/admin/orders/${id}/return`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  },
};

export const inventoryService = {
  list(page = 1, limit = 20) {
    return apiRequest<
      PaginatedResponse<{
        id: string;
        productId: string;
        quantity: number;
        reservedQuantity: number;
        availableQuantity: number;
        minimumQuantity?: number;
        product?: { sku: string; name: string };
      }>
    >(`/admin/inventory?page=${page}&limit=${limit}`);
  },
  critical() {
    return apiRequest<
      Array<{
        productId: string;
        sku: string;
        name: string;
        availableQuantity: number;
        minimumQuantity: number;
      }>
    >("/admin/inventory/critical");
  },
  increase(productId: string, quantity: number, note?: string) {
    return apiRequest(`/admin/inventory/${productId}/increase`, {
      method: "POST",
      body: { quantity, note },
    });
  },
  decrease(productId: string, quantity: number, note?: string) {
    return apiRequest(`/admin/inventory/${productId}/decrease`, {
      method: "POST",
      body: { quantity, note },
    });
  },
};

export const paymentsService = {
  list(
    page = 1,
    limit = 20,
    params?: {
      status?: string;
      method?: string;
      orderNumber?: string;
      from?: string;
      to?: string;
    },
  ) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (params?.status) query.set("status", params.status);
    if (params?.method) query.set("method", params.method);
    if (params?.orderNumber) query.set("orderNumber", params.orderNumber);
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    return apiRequest<PaginatedResponse<AdminPayment>>(
      `/admin/payments?${query.toString()}`,
    );
  },
  get(id: string) {
    return apiRequest<AdminPayment>(`/admin/payments/${id}`);
  },
  refund(id: string) {
    return apiRequest<AdminPayment>(`/admin/payments/${id}/refund`, {
      method: "POST",
    });
  },
  listBankAccounts() {
    return apiRequest<AdminBankAccount[]>("/admin/bank-accounts");
  },
  createBankAccount(body: Record<string, unknown>) {
    return apiRequest<AdminBankAccount>("/admin/bank-accounts", {
      method: "POST",
      body,
    });
  },
  updateBankAccount(id: string, body: Record<string, unknown>) {
    return apiRequest<AdminBankAccount>(`/admin/bank-accounts/${id}`, {
      method: "POST",
      body,
    });
  },
  listBankTransfers(
    page = 1,
    limit = 20,
    params?: { status?: string; search?: string; bankAccountId?: string },
  ) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    if (params?.bankAccountId) query.set("bankAccountId", params.bankAccountId);
    return apiRequest<PaginatedResponse<{
      id: string;
      status: string;
      amount: string;
      orderTotal?: string;
      approvedTotal?: string;
      remainingAmount?: string;
      paymentStatus?: string;
      amountMismatch?: boolean;
      referenceNumber: string | null;
      orderNumber?: string;
      customerName?: string;
      bankName?: string | null;
      bankIban?: string | null;
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
      approvedTotal?: string;
      remainingAmount?: string;
      paymentStatus?: string;
      amountMismatch?: boolean;
      referenceNumber: string | null;
      orderNumber?: string;
      customerName?: string;
      bankName?: string | null;
      bankIban?: string | null;
      createdAt: string;
      transferDate: string;
      note: string | null;
      rejectionReason: string | null;
      adminNote: string | null;
      timeline?: Array<{
        id: string;
        amount: string;
        status: string;
        createdAt: string;
        verifiedAt: string | null;
        rejectionReason: string | null;
        referenceNumber: string | null;
      }>;
    }>(`/admin/bank-transfers/${id}`);
  },
  approveBankTransfer(id: string, body: { adminNote?: string }) {
    return apiRequest(`/admin/bank-transfers/${id}/approve`, {
      method: "POST",
      body,
    });
  },
  rejectBankTransfer(
    id: string,
    body: { rejectionReason: string; adminNote?: string },
  ) {
    return apiRequest(`/admin/bank-transfers/${id}/reject`, {
      method: "POST",
      body,
    });
  },
};

export const accountingService = {
  listTransactions(page = 1, limit = 20, userId?: string) {
    const q = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (userId) q.set("userId", userId);
    return apiRequest<
      PaginatedResponse<{
        id: string;
        type: string;
        amount: string;
        debit: string | null;
        credit: string | null;
        balanceAfter: string | null;
        description: string;
        createdAt: string;
        userId: string;
        reference: string;
        referenceType: string | null;
      }>
    >(`/admin/accounting/transactions?${q}`);
  },
  customerAccount(customerId: string) {
    return apiRequest<{
      totalDebit: string;
      totalCredit: string;
      balance: string;
      currency: string;
      overdueAmount?: string;
      creditLimit?: string | null;
      allowCredit?: boolean;
    }>(`/admin/accounting/customers/${customerId}`);
  },
  statement(customerId: string, format?: "csv") {
    const q = format ? `?format=${format}` : "";
    return apiRequest<{
      summary: {
        totalDebit: string;
        totalCredit: string;
        balance: string;
      };
      items: Array<{
        id: string;
        createdAt: string;
        description: string;
        debit: string | null;
        credit: string | null;
        balanceAfter: string | null;
      }>;
    }>(`/admin/accounting/customers/${customerId}/statement${q}`);
  },
  createManual(body: {
    customerId: string;
    direction: "DEBIT" | "CREDIT";
    amount: string;
    description: string;
    referenceNote?: string;
  }) {
    return apiRequest("/admin/accounting/manual", {
      method: "POST",
      body,
    });
  },
  createAdjustment(body: {
    customerId: string;
    direction: "DEBIT" | "CREDIT";
    amount: string;
    note: string;
  }) {
    return apiRequest("/admin/accounting/adjustment", {
      method: "POST",
      body,
    });
  },
  createReversal(body: {
    customerId: string;
    originalReference: string;
    note: string;
  }) {
    return apiRequest("/admin/accounting/reversal", {
      method: "POST",
      body,
    });
  },
  collections(
    page = 1,
    limit = 20,
    filters?: Record<string, string | undefined>,
  ) {
    const q = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (v) q.set(k, v);
      }
    }
    return apiRequest<PaginatedResponse<Record<string, unknown>>>(
      `/admin/collections?${q}`,
    );
  },
  collectionsSummary() {
    return apiRequest<{
      todayCollections: string;
      monthCollections: string;
      pendingTransfers: number;
      rejectedTransfers: number;
      timezone: string;
    }>("/admin/collections/summary");
  },
  report(report: string, params?: Record<string, string | undefined>) {
    const q = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) q.set(k, v);
      }
    }
    const qs = q.toString();
    return apiRequest(`/admin/finance/reports/${report}${qs ? `?${qs}` : ""}`);
  },
  /** Path relative to NEXT_PUBLIC_API_BASE_URL (/api/v1) for authenticated CSV download. */
  reportCsvPath(
    report: string,
    params?: { dateFrom?: string; dateTo?: string },
  ): string {
    const q = new URLSearchParams({ format: "csv" });
    if (params?.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params?.dateTo) q.set("dateTo", params.dateTo);
    return `/admin/finance/reports/${report}?${q}`;
  },
};

export const customersAdminService = {
  list(page = 1, limit = 20, opts?: { search?: string; filter?: string }) {
    const q = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (opts?.search) q.set("search", opts.search);
    if (opts?.filter) q.set("filter", opts.filter);
    return apiRequest<
      PaginatedResponse<{
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string | null;
        userType: string;
        status: string;
        companyName: string | null;
        balance: string;
        orderCount: number;
        totalSpent: string;
        createdAt: string;
      }>
    >(`/admin/customers?${q}`);
  },
  get(id: string) {
    return apiRequest<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      userType: string;
      status: string;
      createdAt: string;
      corporate: {
        companyName: string;
        taxNumber: string;
        taxOffice: string;
        allowCredit: boolean;
        creditLimit: string | null;
        paymentTermDays: number;
      } | null;
      account: {
        totalDebit: string;
        totalCredit: string;
        balance: string;
        overdueAmount?: string;
        creditLimit?: string | null;
      };
      ordersSummary: {
        orderCount: number;
        totalAmount: string;
        paidAmount: string;
        pendingAmount: string;
      };
      addresses: Array<Record<string, unknown>>;
    }>(`/admin/customers/${id}`);
  },
  orders(id: string, page = 1, limit = 20) {
    return apiRequest(
      `/admin/customers/${id}/orders?page=${page}&limit=${limit}`,
    );
  },
  updateStatus(id: string, status: string) {
    return apiRequest(`/admin/customers/${id}/status`, {
      method: "PATCH",
      body: { status },
    });
  },
  update(id: string, body: Record<string, unknown>) {
    return apiRequest(`/admin/customers/${id}`, {
      method: "PATCH",
      body: body,
    });
  },
  invite(body: Record<string, unknown>) {
    return apiRequest<{ id: string; email: string }>(
      "/admin/customers/invite",
      {
        method: "POST",
        body,
      },
    );
  },
  importRows(
    rows: Array<{
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      userType?: string;
      companyName?: string;
      taxNumber?: string;
      taxOffice?: string;
    }>,
  ) {
    return apiRequest<{
      results: Array<{
        row: number;
        email: string;
        status: "created" | "skipped" | "error";
        error?: string;
      }>;
    }>("/admin/customers/import", {
      method: "POST",
      body: { rows },
    });
  },
  exportUrl(opts?: { search?: string; filter?: string }) {
    const q = new URLSearchParams();
    if (opts?.search) q.set("search", opts.search);
    if (opts?.filter) q.set("filter", opts.filter);
    return `/admin/customers/export?${q}`;
  },
};

export const campaignsService = {
  list() {
    return apiRequest<
      Array<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        type: string;
        priority: number;
        active: boolean;
        startsAt: string;
        endsAt: string;
      }>
    >("/admin/campaigns");
  },
  get(id: string) {
    return apiRequest<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      type: string;
      priority: number;
      active: boolean;
      startsAt: string;
      endsAt: string;
    }>(`/admin/campaigns/${id}`);
  },
  create(body: Record<string, unknown>) {
    return apiRequest("/admin/campaigns", { method: "POST", body });
  },
  update(id: string, body: Record<string, unknown>) {
    return apiRequest(`/admin/campaigns/${id}`, { method: "PATCH", body });
  },
  remove(id: string) {
    return apiRequest(`/admin/campaigns/${id}`, { method: "DELETE" });
  },
  listProducts(id: string) {
    return apiRequest<
      Array<{
        id: string;
        productId: string;
        product?: { id: string; name: string; sku: string; slug: string };
        discountPercentage: string | null;
        discountAmount: string | null;
        specialPrice: string | null;
      }>
    >(`/admin/campaigns/${id}/products`);
  },
  addProduct(id: string, body: Record<string, unknown>) {
    return apiRequest(`/admin/campaigns/${id}/products`, {
      method: "POST",
      body,
    });
  },
  removeProduct(id: string, productId: string) {
    return apiRequest(`/admin/campaigns/${id}/products/${productId}`, {
      method: "DELETE",
    });
  },
};

export const couponsAdminService = {
  list() {
    return apiRequest<
      Array<{
        id: string;
        code: string;
        type: string;
        value: string;
        usageCount: number;
        usageLimit: number | null;
        startsAt: string;
        endsAt: string;
        active: boolean;
      }>
    >("/admin/coupons");
  },
  create(body: Record<string, unknown>) {
    return apiRequest("/admin/coupons", { method: "POST", body });
  },
  update(id: string, body: Record<string, unknown>) {
    return apiRequest(`/admin/coupons/${id}`, { method: "PATCH", body });
  },
};

export const bannersService = {
  list() {
    return apiRequest<
      Array<{
        id: string;
        title: string;
        subtitle: string | null;
        imageUrl: string;
        mobileImageUrl: string | null;
        linkType: string;
        linkValue: string | null;
        active: boolean;
        sortOrder: number;
        startsAt: string | null;
        endsAt: string | null;
      }>
    >("/admin/banners");
  },
  create(body: Record<string, unknown>) {
    return apiRequest("/admin/banners", { method: "POST", body });
  },
  update(id: string, body: Record<string, unknown>) {
    return apiRequest(`/admin/banners/${id}`, { method: "PATCH", body });
  },
  remove(id: string) {
    return apiRequest(`/admin/banners/${id}`, { method: "DELETE" });
  },
};

export const customerPricingService = {
  list(customerId: string) {
    return apiRequest<
      Array<{
        id: string;
        customerId?: string;
        productId: string;
        price: string;
        currency: string;
        validFrom: string | null;
        validTo: string | null;
        active: boolean;
      }>
    >(`/admin/pricing/customers/${customerId}`);
  },
  create(customerId: string, body: Record<string, unknown>) {
    return apiRequest(`/admin/pricing/customers/${customerId}`, {
      method: "POST",
      body,
    });
  },
  update(priceId: string, body: Record<string, unknown>) {
    return apiRequest(`/admin/pricing/customer-prices/${priceId}`, {
      method: "PATCH",
      body,
    });
  },
  deactivate(priceId: string) {
    return apiRequest(`/admin/pricing/customer-prices/${priceId}`, {
      method: "DELETE",
    });
  },
};

export const notificationsService = {
  list(
    page = 1,
    limit = 20,
    filters?: { eventKey?: string; type?: string; from?: string; to?: string },
  ) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (filters?.eventKey) params.set("eventKey", filters.eventKey);
    if (filters?.type) params.set("type", filters.type);
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    return apiRequest<
      PaginatedResponse<{
        id: string;
        type: string;
        title: string;
        createdAt: string;
        readAt?: string | null;
      }>
    >(`/admin/notifications?${params.toString()}`);
  },
  summary() {
    return apiRequest<{
      pendingOutbox: number;
      sentToday: number;
      failedToday: number;
      retrying: number;
      inAppTotal: number;
      pushDevicesActive: number;
    }>("/admin/notifications/summary");
  },
};

export type EmailOutboxItem = {
  id: string;
  event: string;
  eventKey: string | null;
  toEmail: string;
  subject: string;
  status: string;
  attempts: number;
  lastError: string | null;
  providerMessageId: string | null;
  createdAt: string;
  sentAt: string | null;
  failedAt: string | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string;
};

export const emailOutboxService = {
  list(filters?: {
    page?: number;
    limit?: number;
    status?: string;
    event?: string;
    toEmail?: string;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams({
      page: String(filters?.page ?? 1),
      limit: String(filters?.limit ?? 20),
    });
    if (filters?.status) params.set("status", filters.status);
    if (filters?.event) params.set("event", filters.event);
    if (filters?.toEmail) params.set("toEmail", filters.toEmail);
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    return apiRequest<PaginatedResponse<EmailOutboxItem>>(
      `/admin/email-outbox?${params.toString()}`,
    );
  },
  summary() {
    return apiRequest<{
      pending: number;
      processing: number;
      retrying: number;
      sentToday: number;
      failedToday: number;
      emailTotal: number;
    }>("/admin/email-outbox/summary");
  },
  retry(id: string) {
    return apiRequest<{ id: string; status: string; attempts: number }>(
      `/admin/email-outbox/${id}/retry`,
      { method: "POST" },
    );
  },
};

export type LegalPage = {
  slug: string;
  title: string;
  body: string;
  version?: number;
  updatedAt: string;
};

export const legalAdminService = {
  list() {
    return apiRequest<LegalPage[]>("/admin/legal");
  },
  get(slug: string) {
    return apiRequest<LegalPage>(`/admin/legal/${slug}`);
  },
  update(slug: string, body: { title?: string; body?: string }) {
    return apiRequest<LegalPage>(`/admin/legal/${slug}`, {
      method: "PUT",
      body,
    });
  },
};

export type AdminRbacUser = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
};

export type AdminRoleItem = {
  id: string;
  code: string;
};

export type SalePaymentMethod = "CASH" | "CREDIT_CARD" | "BANK_TRANSFER";
export type SaleStatus = "COMPLETED" | "CANCELLED";

export type AdminSalePerson = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type AdminSaleItem = {
  id: string;
  productId: string | null;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
  taxAmount: string;
  lineSubtotal: string;
  lineTotal: string;
};

export type AdminSale = {
  id: string;
  saleNumber: string;
  customerId: string | null;
  customerLabel: string;
  customer: AdminSalePerson | null;
  createdBy: AdminSalePerson;
  status: SaleStatus;
  paymentMethod: SalePaymentMethod;
  currency: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  note: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  items: AdminSaleItem[];
  itemCount: number;
};

export type DailySalesSummary = {
  date: string;
  totalSales: string;
  saleCount: number;
  itemCount: number;
  refundTotal: string;
  retailSaleCount: number;
  customerSaleCount: number;
  paymentBreakdown: {
    cash: string;
    card: string;
    bankTransfer: string;
  };
};

export type AdminSaleListParams = {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  createdById?: string;
  paymentMethod?: SalePaymentMethod;
  status?: SaleStatus;
  search?: string;
  retailOnly?: boolean;
};

export type InvoiceStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
export type InvoiceDisplayStatus =
  | "DRAFT"
  | "FORMALIZED"
  | "PENDING"
  | "FAILED"
  | "CANCELLED";
export type InvoiceDocumentType = "E_INVOICE" | "E_ARCHIVE";

export type AdminInvoiceListItem = {
  id: string;
  saleId: string;
  saleNumber: string;
  customerId: string;
  customerLabel: string;
  provider: string;
  documentType: InvoiceDocumentType;
  status: InvoiceStatus;
  displayStatus: InvoiceDisplayStatus;
  externalDocumentId: string | null;
  invoiceNumber: string | null;
  uuid: string | null;
  currency: string;
  totalAmount: string;
  errorCode: string | null;
  canFormalize: boolean;
  canRetry: boolean;
  canDownloadPdf: boolean;
  canDownloadXml: boolean;
  canSync: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminInvoiceDetail = AdminInvoiceListItem & {
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  errorMessage: string | null;
  billingAddressId: string | null;
  billingAddressSnapshot: {
    title?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    city?: string;
    district?: string;
    neighborhood?: string | null;
    addressLine?: string;
    postalCode?: string | null;
    country?: string;
    companyName?: string | null;
  };
  createdBy: { id: string; firstName: string; lastName: string; email: string };
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  issuedAt: string | null;
};

export type AdminInvoiceListParams = {
  status?: InvoiceStatus;
  provider?: string;
  documentType?: InvoiceDocumentType;
  customerId?: string;
  saleId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  invoiceNumber?: string;
  externalDocumentId?: string;
  uuid?: string;
  formalized?: boolean;
};

export const invoicesService = {
  list(page = 1, limit = 50, params?: AdminInvoiceListParams) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (params?.status) query.set("status", params.status);
    if (params?.provider) query.set("provider", params.provider);
    if (params?.documentType) query.set("documentType", params.documentType);
    if (params?.customerId) query.set("customerId", params.customerId);
    if (params?.saleId) query.set("saleId", params.saleId);
    if (params?.search) query.set("search", params.search);
    if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
    if (params?.dateTo) query.set("dateTo", params.dateTo);
    if (params?.invoiceNumber) query.set("invoiceNumber", params.invoiceNumber);
    if (params?.externalDocumentId) {
      query.set("externalDocumentId", params.externalDocumentId);
    }
    if (params?.uuid) query.set("uuid", params.uuid);
    if (params?.formalized === true) query.set("formalized", "true");
    if (params?.formalized === false) query.set("formalized", "false");
    return apiRequest<PaginatedResponse<AdminInvoiceListItem>>(
      `/admin/invoices?${query.toString()}`,
    );
  },
  getById(id: string) {
    return apiRequest<AdminInvoiceDetail>(`/admin/invoices/${id}`);
  },
  createFromSale(
    saleId: string,
    body?: { billingAddressId?: string; documentType?: InvoiceDocumentType },
  ) {
    return apiRequest<{ invoiceId: string; saleId: string; status: string }>(
      `/admin/invoices/from-sale/${saleId}`,
      { method: "POST", body: body ?? {} },
    );
  },
  formalize(invoiceId: string, body?: { prefix?: string }) {
    return apiRequest<{
      invoiceId: string;
      uuid: string;
      invoiceNumber: string | null;
      alreadyFormalized: boolean;
    }>(`/admin/invoices/${invoiceId}/formalize`, {
      method: "POST",
      body: body ?? {},
    });
  },
  sync(invoiceId: string) {
    return apiRequest<{
      invoiceId: string;
      status: InvoiceStatus;
      displayStatus: InvoiceDisplayStatus;
      uuid: string | null;
      invoiceNumber: string | null;
      externalDocumentId: string | null;
      providerEDocumentStatus: string | null;
      providerCommercialStatus: string | null;
      updated: boolean;
    }>(`/admin/invoices/${invoiceId}/sync`, { method: "POST", body: {} });
  },
  async downloadPdf(invoiceId: string, filename: string, view = false) {
    await apiDownloadBlob(`/admin/invoices/${invoiceId}/pdf`, {
      filename,
      accept: "application/pdf",
      openInNewTab: view,
    });
  },
  async downloadXml(invoiceId: string, filename: string) {
    await apiDownloadBlob(`/admin/invoices/${invoiceId}/xml`, {
      filename,
      accept: "application/xml",
    });
  },
};

export const salesService = {
  list(page = 1, limit = 50, params?: AdminSaleListParams) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (params?.date) query.set("date", params.date);
    if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
    if (params?.dateTo) query.set("dateTo", params.dateTo);
    if (params?.customerId) query.set("customerId", params.customerId);
    if (params?.createdById) query.set("createdById", params.createdById);
    if (params?.paymentMethod) query.set("paymentMethod", params.paymentMethod);
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    if (params?.retailOnly) query.set("retailOnly", "true");
    return apiRequest<PaginatedResponse<AdminSale>>(
      `/admin/sales?${query.toString()}`,
    );
  },
  dailySummary(date: string) {
    return apiRequest<DailySalesSummary>(
      `/admin/sales/daily-summary?date=${encodeURIComponent(date)}`,
    );
  },
  getById(id: string) {
    return apiRequest<AdminSale>(`/admin/sales/${id}`);
  },
  create(body: {
    customerId?: string | null;
    items: Array<{
      productId: string;
      quantity: number;
      discountAmount?: number;
    }>;
    paymentMethod: SalePaymentMethod;
    note?: string;
  }) {
    return apiRequest<AdminSale>("/admin/sales", {
      method: "POST",
      body,
    });
  },
  cancel(id: string, reason?: string) {
    return apiRequest<AdminSale>(`/admin/sales/${id}/cancel`, {
      method: "POST",
      body: { reason },
    });
  },
};

export const rbacService = {
  listRoles() {
    return apiRequest<AdminRoleItem[]>("/admin/rbac/roles");
  },
  listUsers() {
    return apiRequest<AdminRbacUser[]>("/admin/rbac/users");
  },
  lookup(email: string) {
    return apiRequest<AdminRbacUser>(
      `/admin/rbac/users/lookup?email=${encodeURIComponent(email)}`,
    );
  },
  assignByEmail(email: string, roleCode: string) {
    return apiRequest<AdminRbacUser>("/admin/rbac/assign", {
      method: "POST",
      body: { email, roleCode },
    });
  },
  assignRole(userId: string, roleCode: string) {
    return apiRequest<AdminRbacUser>(`/admin/rbac/users/${userId}/roles`, {
      method: "POST",
      body: { roleCode },
    });
  },
  removeRole(userId: string, roleCode: string) {
    return apiRequest<AdminRbacUser>(
      `/admin/rbac/users/${userId}/roles/${roleCode}`,
      { method: "DELETE" },
    );
  },
};

export type PosPaymentMethod =
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "ON_ACCOUNT";
export type PosSaleStatus = "COMPLETED" | "CANCELLED" | "REFUNDED";

export type AdminPosRegister = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminPosCashier = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  name: string;
};

export type AdminPosSaleListItem = {
  id: string;
  saleNumber: string;
  createdAt: string;
  completedAt: string | null;
  registerId: string;
  registerCode: string;
  registerName: string;
  userId: string;
  cashierName: string;
  customerId: string | null;
  customerName: string | null;
  grandTotal: string;
  status: PosSaleStatus;
  paymentMethods: string[];
};

export type AdminPosSaleListParams = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  registerId?: string;
  userId?: string;
  customerId?: string;
  paymentMethod?: PosPaymentMethod;
  status?: PosSaleStatus;
};

export type AdminPosSaleDetail = {
  id: string;
  saleNumber: string;
  registerId: string;
  userId: string;
  customerId: string | null;
  status: PosSaleStatus;
  currency: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  note: string | null;
  completedAt: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    sku: string;
    barcode: string | null;
    quantity: number;
    returnedQuantity: number;
    returnableQuantity: number;
    unitPrice: string;
    discountAmount: string;
    taxRate: string;
    taxAmount: string;
    lineSubtotal: string;
    lineTotal: string;
  }>;
  payments: Array<{
    id: string;
    method: PosPaymentMethod;
    amount: string;
    status: string;
    referenceNumber: string | null;
    createdAt: string;
  }>;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  cashier: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  register: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
  } | null;
  account: {
    balance: string;
    currency: string;
    creditLimit: string | null;
    allowCredit: boolean;
  } | null;
  ledger: Array<{
    id: string;
    type: string;
    amount: string;
    debit: string | null;
    credit: string | null;
    description: string;
    reference: string;
    referenceType: string | null;
    referenceId: string | null;
    createdAt: string;
  }>;
};

export type AdminPosReportSummary = {
  from: string;
  to: string;
  timezone: string;
  totalSales: number;
  grossSales: string;
  returns: string;
  netSales: string;
  totalItems: number;
  averageBasket: string;
  returnCount: number;
  paymentBreakdown: Array<{
    method: PosPaymentMethod;
    count: number;
    amount: string;
  }>;
  registerBreakdown: Array<{
    registerId: string;
    registerCode: string;
    registerName: string;
    saleCount: number;
    revenue: string;
  }>;
  cashierBreakdown: Array<{
    cashierId: string;
    cashierName: string;
    saleCount: number;
    revenue: string;
  }>;
  generatedAt?: string;
};

export type AdminPosReturn = {
  id: string;
  saleId: string;
  saleNumber: string;
  totalAmount: string;
  saleStatus: PosSaleStatus;
  createdAt: string;
  items: Array<{
    id: string;
    saleItemId: string;
    productName: string;
    quantity: number;
    lineRefund: string;
  }>;
  payments: Array<{ method: PosPaymentMethod; amount: string }>;
};

export type AdminPosReportParams = {
  from: string;
  to: string;
  registerId?: string;
  cashierId?: string;
};

export function buildAdminPosReportPath(
  kind: "summary" | "x" | "export.csv",
  params?: Partial<AdminPosReportParams>,
): string {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.registerId) query.set("registerId", params.registerId);
  if (params?.cashierId) query.set("cashierId", params.cashierId);
  const qs = query.toString();
  return `/admin/pos/reports/${kind}${qs ? `?${qs}` : ""}`;
}

/** Query path helper (also used by unit tests). */
export function buildAdminPosSalesPath(
  page = 1,
  limit = 50,
  params?: AdminPosSaleListParams,
): string {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (params?.search) query.set("search", params.search);
  if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params?.dateTo) query.set("dateTo", params.dateTo);
  if (params?.registerId) query.set("registerId", params.registerId);
  if (params?.userId) query.set("userId", params.userId);
  if (params?.customerId) query.set("customerId", params.customerId);
  if (params?.paymentMethod) query.set("paymentMethod", params.paymentMethod);
  if (params?.status) query.set("status", params.status);
  return `/admin/pos/sales?${query.toString()}`;
}

export const posAdminService = {
  listRegisters() {
    return apiRequest<AdminPosRegister[]>("/admin/pos/registers");
  },
  createRegister(body: { name: string; code: string; isActive?: boolean }) {
    return apiRequest<AdminPosRegister>("/admin/pos/registers", {
      method: "POST",
      body,
    });
  },
  updateRegister(
    id: string,
    body: { name?: string; code?: string; isActive?: boolean },
  ) {
    return apiRequest<AdminPosRegister>(`/admin/pos/registers/${id}`, {
      method: "PATCH",
      body,
    });
  },
  listCashiers() {
    return apiRequest<AdminPosCashier[]>("/admin/pos/cashiers");
  },
  listSales(page = 1, limit = 50, params?: AdminPosSaleListParams) {
    return apiRequest<PaginatedResponse<AdminPosSaleListItem>>(
      buildAdminPosSalesPath(page, limit, params),
    );
  },
  getSale(id: string) {
    return apiRequest<AdminPosSaleDetail>(`/admin/pos/sales/${id}`);
  },
  reportSummary(params: AdminPosReportParams) {
    return apiRequest<AdminPosReportSummary>(
      buildAdminPosReportPath("summary", params),
    );
  },
  reportX(params?: { registerId?: string; cashierId?: string }) {
    return apiRequest<AdminPosReportSummary>(
      buildAdminPosReportPath("x", params),
    );
  },
  reportCsvPath(params: AdminPosReportParams) {
    return buildAdminPosReportPath("export.csv", params);
  },
  createReturn(
    saleId: string,
    body: {
      items: Array<{ saleItemId: string; quantity: number }>;
      reason?: string;
      note?: string;
    },
    idempotencyKey: string,
  ) {
    return apiRequest<AdminPosReturn>(`/admin/pos/sales/${saleId}/returns`, {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey },
    });
  },
};
