/** Types matching Nest API DTOs (api/src/modules/…). */

export type PosPaymentMethod =
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "ON_ACCOUNT";

export type PosPaymentStatus = "COMPLETED" | "PENDING" | "FAILED" | "REFUNDED";
export type PosSaleStatus = "COMPLETED" | "CANCELLED" | "REFUNDED";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  userType: string;
  status: string;
  roles: string[];
  permissions: string[];
}

export interface AuthTokensResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface PosRegister {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  openedAt: string | null;
  closedAt: string | null;
}

export interface PosProductLookup {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  vatRate: string;
  unitPrice: string | null;
  availableStock: number;
}

export interface PosPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface PosAccountSnapshot {
  balance: string;
  currency: string;
  creditLimit: string | null;
  allowCredit: boolean;
}

export interface PosSaleItem {
  id: string;
  productId: string | null;
  productName: string;
  sku: string;
  barcode: string | null;
  quantity: number;
  returnedQuantity?: number;
  returnableQuantity?: number;
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
  taxAmount: string;
  lineSubtotal: string;
  lineTotal: string;
}

export interface PosPayment {
  id: string;
  method: PosPaymentMethod;
  amount: string;
  status: PosPaymentStatus;
  referenceNumber: string | null;
  createdAt: string;
}

export interface PosSale {
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
  idempotencyKey: string | null;
  completedAt: string | null;
  createdAt: string;
  items: PosSaleItem[];
  payments: PosPayment[];
  customer: PosPerson | null;
  cashier: PosPerson | null;
  register: PosRegister | null;
  account: PosAccountSnapshot | null;
}

export interface CreatePosSaleItem {
  productId: string;
  quantity: number;
  discountAmount?: number;
}

export interface CreatePosPayment {
  method: PosPaymentMethod;
  amount: number;
  referenceNumber?: string;
}

export interface CreatePosSaleRequest {
  registerId: string;
  customerId?: string | null;
  items: CreatePosSaleItem[];
  payments: CreatePosPayment[];
  cartDiscountAmount?: number;
  cartDiscountPercent?: number;
  note?: string;
}

export interface PosReturn {
  id: string;
  saleId: string;
  saleNumber: string;
  totalAmount: string;
  saleStatus: PosSaleStatus;
  createdAt: string;
}

export interface CreatePosReturnRequest {
  items: Array<{ saleItemId: string; quantity: number }>;
  reason?: string;
  note?: string;
}

export interface CustomerListItem {
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
}

export interface Paginated<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CustomerDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  userType: string;
  status: string;
  corporate?: {
    companyName: string;
    allowCredit: boolean;
    creditLimit: string | null;
  } | null;
  account?: {
    balance: string;
    creditLimit?: string | null;
    allowCredit?: boolean;
  };
}

export interface ApiErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}
