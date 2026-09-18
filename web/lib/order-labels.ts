export function orderStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Beklemede";
    case "CONFIRMED":
      return "Onaylandı";
    case "PREPARING":
      return "Hazırlanıyor";
    case "SHIPPED":
      return "Kargoya verildi";
    case "DELIVERED":
      return "Teslim edildi";
    case "CANCELLED":
      return "İptal edildi";
    case "RETURNED":
      return "İade edildi";
    default:
      return status;
  }
}

export function paymentStatusLabel(status?: string | null): string {
  switch (status) {
    case "PENDING":
      return "Ödeme bekleniyor";
    case "AUTHORIZED":
      return "Ödeme yetkilendirildi";
    case "PARTIALLY_PAID":
      return "Kısmi ödeme alındı";
    case "PAID":
      return "Ödeme alındı";
    case "FAILED":
      return "Ödeme doğrulanamadı";
    case "REFUNDED":
      return "İade edildi";
    case "CANCELLED":
      return "Ödeme iptal edildi";
    default:
      return status ?? "—";
  }
}

export function paymentMethodLabel(method?: string | null): string {
  switch (method) {
    case "BANK_TRANSFER":
      return "Havale / EFT";
    case "CREDIT_CARD":
      return "Kredi kartı";
    case "CASH_ON_DELIVERY":
      return "Kapıda ödeme";
    default:
      return method ?? "—";
  }
}

export function shippingStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Beklemede";
    case "READY":
      return "Kargoya hazır";
    case "SHIPPED":
      return "Yolda";
    case "DELIVERED":
      return "Teslim edildi";
    case "RETURNED":
      return "İade";
    case "CANCELLED":
      return "İptal";
    default:
      return status;
  }
}

export function shippingProviderLabel(provider: string): string {
  switch (provider) {
    case "MANUAL":
      return "Manuel kargo";
    default:
      return provider;
  }
}

export function orderStatusTone(
  status: string,
): "neutral" | "success" | "warning" | "danger" | "accent" {
  switch (status) {
    case "DELIVERED":
      return "success";
    case "CANCELLED":
    case "RETURNED":
      return "danger";
    case "SHIPPED":
    case "PREPARING":
      return "accent";
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

export function paymentStatusTone(
  status?: string | null,
): "neutral" | "success" | "warning" | "danger" | "accent" {
  switch (status) {
    case "PAID":
      return "success";
    case "PARTIALLY_PAID":
      return "accent";
    case "FAILED":
    case "CANCELLED":
      return "danger";
    case "PENDING":
    case "AUTHORIZED":
      return "warning";
    case "REFUNDED":
      return "accent";
    default:
      return "neutral";
  }
}
