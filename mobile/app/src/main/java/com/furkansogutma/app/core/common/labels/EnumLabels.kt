package com.furkansogutma.app.core.common.labels

/** Turkish display labels for API enum values shown in the UI. */
object EnumLabels {
    fun orderStatus(status: String?): String = when (status) {
        "PENDING" -> "Beklemede"
        "CONFIRMED" -> "Onaylandı"
        "PREPARING" -> "Hazırlanıyor"
        "SHIPPED" -> "Kargoya verildi"
        "DELIVERED" -> "Teslim edildi"
        "CANCELLED" -> "İptal edildi"
        "RETURNED" -> "İade edildi"
        else -> status.orEmpty().ifBlank { "—" }
    }

    fun paymentStatus(status: String?): String = when (status) {
        "PENDING" -> "Ödeme bekleniyor"
        "AUTHORIZED" -> "Ödeme yetkilendirildi"
        "PARTIALLY_PAID" -> "Kısmi ödeme alındı"
        "PAID" -> "Ödeme alındı"
        "FAILED" -> "Ödeme doğrulanamadı"
        "REFUNDED" -> "İade edildi"
        "CANCELLED" -> "Ödeme iptal edildi"
        else -> status.orEmpty().ifBlank { "—" }
    }

    fun paymentMethod(method: String?): String = when (method) {
        "BANK_TRANSFER" -> "Havale / EFT"
        "CREDIT_CARD" -> "Kredi kartı"
        "CASH_ON_DELIVERY" -> "Kapıda ödeme"
        else -> method.orEmpty().ifBlank { "—" }
    }

    fun shippingStatus(status: String?): String = when (status) {
        "PENDING" -> "Beklemede"
        "READY" -> "Kargoya hazır"
        "SHIPPED" -> "Yolda"
        "DELIVERED" -> "Teslim edildi"
        "RETURNED" -> "İade"
        "CANCELLED" -> "İptal"
        else -> status.orEmpty().ifBlank { "—" }
    }

    fun bankTransferStatus(status: String?): String = when (status) {
        "PENDING" -> "İnceleniyor"
        "APPROVED" -> "Onaylandı"
        "REJECTED" -> "Reddedildi"
        else -> status.orEmpty().ifBlank { "—" }
    }

    fun accountTxType(type: String?): String = when (type) {
        "DEBIT" -> "Borç"
        "CREDIT" -> "Alacak"
        else -> type.orEmpty().ifBlank { "—" }
    }

    fun userType(type: String?): String = when (type) {
        "INDIVIDUAL" -> "Bireysel"
        "CORPORATE" -> "Kurumsal"
        else -> type.orEmpty().ifBlank { "—" }
    }

    fun campaignType(type: String?): String = when (type) {
        "PERCENTAGE" -> "Yüzde indirim"
        "FIXED_AMOUNT" -> "Sabit tutar"
        "SPECIAL_PRICE" -> "Özel fiyat"
        else -> type.orEmpty().ifBlank { "—" }
    }

    fun campaignStatus(status: String?): String = when (status) {
        "ACTIVE", "active", "true" -> "Aktif"
        "INACTIVE", "inactive", "false" -> "Pasif"
        else -> status.orEmpty().ifBlank { "—" }
    }

    fun alertStatus(status: String?): String = when (status) {
        "ACTIVE" -> "Aktif"
        "TRIGGERED" -> "Tetiklendi"
        "CANCELLED" -> "İptal"
        else -> status.orEmpty().ifBlank { "—" }
    }

    fun priceType(type: String?): String = when (type) {
        "RETAIL" -> "Perakende"
        "CAMPAIGN" -> "Kampanya"
        "WHOLESALE" -> "Toptan"
        "CORPORATE" -> "Kurumsal"
        else -> type.orEmpty().ifBlank { "—" }
    }
}
