/** Turkish display labels for API enum values (admin UI). */

export function labelOrFallback(
  map: Record<string, string>,
  value: string | null | undefined,
  fallback = "—",
): string {
  if (!value) return fallback;
  return map[value] ?? value;
}

export const USER_TYPE_LABEL: Record<string, string> = {
  INDIVIDUAL: "Bireysel",
  CORPORATE: "Kurumsal",
};

export const USER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Pasif",
  BLOCKED: "Engelli",
};

export const PRICE_TYPE_LABEL: Record<string, string> = {
  RETAIL: "Perakende",
  CAMPAIGN: "Kampanya",
  WHOLESALE: "Toptan",
  CORPORATE: "Kurumsal",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Bekliyor",
  CONFIRMED: "Onaylandı",
  PREPARING: "Hazırlanıyor",
  SHIPPED: "Kargoda",
  DELIVERED: "Teslim edildi",
  CANCELLED: "İptal",
  RETURNED: "İade",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Bekliyor",
  AUTHORIZED: "Yetkilendirildi",
  PARTIALLY_PAID: "Kısmi ödendi",
  PAID: "Ödendi",
  FAILED: "Başarısız",
  REFUNDED: "İade edildi",
  CANCELLED: "İptal",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Havale / EFT",
  CREDIT_CARD: "Kredi kartı",
  CASH_ON_DELIVERY: "Kapıda ödeme",
  CASH: "Nakit",
};

export const SALE_STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};

export const SALE_PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Kartı",
  BANK_TRANSFER: "Havale / EFT",
};

export const POS_SALE_STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
  REFUNDED: "İade",
};

export const POS_PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Nakit",
  CARD: "Kart",
  BANK_TRANSFER: "Havale / EFT",
  ON_ACCOUNT: "Açık hesap",
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  PENDING: "Bekliyor",
  SUCCESS: "Başarılı",
  FAILED: "Başarısız",
  CANCELLED: "İptal",
};

export const INVOICE_DISPLAY_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Taslak",
  FORMALIZED: "Resmileştirilmiş",
  PENDING: "Bekliyor",
  FAILED: "Başarısız",
  CANCELLED: "İptal",
};

export const INVOICE_DOCUMENT_TYPE_LABEL: Record<string, string> = {
  E_INVOICE: "e-Fatura",
  E_ARCHIVE: "e-Arşiv",
};

export const SHIPPING_STATUS_LABEL: Record<string, string> = {
  PENDING: "Beklemede",
  READY: "Kargoya hazır",
  SHIPPED: "Yolda",
  DELIVERED: "Teslim edildi",
  RETURNED: "İade",
  CANCELLED: "İptal",
};

export const BANK_TRANSFER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
};

export const ACCOUNT_TX_TYPE_LABEL: Record<string, string> = {
  DEBIT: "Borç",
  CREDIT: "Alacak",
};

export const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  PERCENTAGE: "Yüzde indirim",
  FIXED_AMOUNT: "Sabit tutar",
  SPECIAL_PRICE: "Özel fiyat",
};

export const COUPON_TYPE_LABEL: Record<string, string> = {
  PERCENTAGE: "Yüzde",
  FIXED_AMOUNT: "Sabit tutar",
};

export const BANNER_LINK_TYPE_LABEL: Record<string, string> = {
  NONE: "Yok",
  PRODUCT: "Ürün",
  CATEGORY: "Kategori",
  CAMPAIGN: "Kampanya",
  URL: "Bağlantı (URL)",
};

export const IMPORT_JOB_TYPE_LABEL: Record<string, string> = {
  PRODUCTS: "Ürünler",
  PRICES: "Fiyatlar",
  STOCK: "Stok",
  PRODUCT_STATUS: "Ürün durumu",
  CUSTOMERS: "Müşteriler",
};

export const IMPORT_JOB_STATUS_LABEL: Record<string, string> = {
  PENDING: "Bekliyor",
  VALIDATING: "Doğrulanıyor",
  READY: "Hazır",
  PROCESSING: "İşleniyor",
  COMPLETED: "Tamamlandı",
  PARTIAL: "Kısmi",
  FAILED: "Başarısız",
};

export const INVENTORY_TX_TYPE_LABEL: Record<string, string> = {
  STOCK_IN: "Stok girişi",
  STOCK_OUT: "Stok çıkışı",
  ADJUSTMENT: "Düzeltme",
  RESERVATION: "Rezervasyon",
  RELEASE: "Rezervasyon çözme",
  SALE: "Satış",
  RETURN: "İade",
};

export const ADMIN_ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Süper yönetici",
  PRODUCT_MANAGER: "Ürün yöneticisi",
  ORDER_MANAGER: "Sipariş yöneticisi",
  STOCK_MANAGER: "Stok yöneticisi",
  CUSTOMER_MANAGER: "Müşteri yöneticisi",
  ACCOUNTING: "Muhasebe",
};

export function priceTypeLabel(v?: string | null) {
  return labelOrFallback(PRICE_TYPE_LABEL, v);
}
export function orderStatusLabel(v?: string | null) {
  return labelOrFallback(ORDER_STATUS_LABEL, v);
}
export function paymentStatusLabel(v?: string | null) {
  return labelOrFallback(PAYMENT_STATUS_LABEL, v);
}
export function paymentMethodLabel(v?: string | null) {
  return labelOrFallback(PAYMENT_METHOD_LABEL, v);
}
export function shippingStatusLabel(v?: string | null) {
  return labelOrFallback(SHIPPING_STATUS_LABEL, v);
}
export function bankTransferStatusLabel(v?: string | null) {
  return labelOrFallback(BANK_TRANSFER_STATUS_LABEL, v);
}
export function userStatusLabel(v?: string | null) {
  return labelOrFallback(USER_STATUS_LABEL, v);
}
export function userTypeLabel(v?: string | null) {
  return labelOrFallback(USER_TYPE_LABEL, v);
}
export function campaignTypeLabel(v?: string | null) {
  return labelOrFallback(CAMPAIGN_TYPE_LABEL, v);
}
export function couponTypeLabel(v?: string | null) {
  return labelOrFallback(COUPON_TYPE_LABEL, v);
}
export function bannerLinkTypeLabel(v?: string | null) {
  return labelOrFallback(BANNER_LINK_TYPE_LABEL, v);
}
export function importJobTypeLabel(v?: string | null) {
  return labelOrFallback(IMPORT_JOB_TYPE_LABEL, v);
}
export function importJobStatusLabel(v?: string | null) {
  return labelOrFallback(IMPORT_JOB_STATUS_LABEL, v);
}
export function accountTxTypeLabel(v?: string | null) {
  return labelOrFallback(ACCOUNT_TX_TYPE_LABEL, v);
}
export function saleStatusLabel(v?: string | null) {
  return labelOrFallback(SALE_STATUS_LABEL, v);
}
export function salePaymentMethodLabel(v?: string | null) {
  return labelOrFallback(SALE_PAYMENT_METHOD_LABEL, v);
}
export function posSaleStatusLabel(v?: string | null) {
  return labelOrFallback(POS_SALE_STATUS_LABEL, v);
}
export function posPaymentMethodLabel(v?: string | null) {
  return labelOrFallback(POS_PAYMENT_METHOD_LABEL, v);
}
export function invoiceStatusLabel(v?: string | null) {
  return labelOrFallback(INVOICE_STATUS_LABEL, v);
}
export function invoiceDisplayStatusLabel(v?: string | null) {
  return labelOrFallback(INVOICE_DISPLAY_STATUS_LABEL, v);
}
export function invoiceDocumentTypeLabel(v?: string | null) {
  return labelOrFallback(INVOICE_DOCUMENT_TYPE_LABEL, v);
}
