package com.furkansogutma.app.feature.banktransfer.presentation

import java.math.BigDecimal
import java.math.RoundingMode
import java.text.NumberFormat
import java.util.Currency as JavaCurrency
import java.util.Locale

internal fun transferStatusLabel(status: String): String = when (status) {
    "PENDING" -> "İnceleniyor"
    "APPROVED" -> "Onaylandı"
    "REJECTED" -> "Reddedildi"
    else -> status
}

internal fun formatTryDisplay(amount: String?): String {
    if (amount.isNullOrBlank()) return "—"
    val value = amount.toBigDecimalOrNull() ?: return "$amount ₺"
    val formatter = NumberFormat.getCurrencyInstance(Locale("tr", "TR"))
    formatter.currency = JavaCurrency.getInstance("TRY")
    formatter.minimumFractionDigits = 2
    formatter.maximumFractionDigits = 2
    return formatter.format(value)
}

internal fun toApiMoneyAmount(raw: String): String? {
    val trimmed = raw.trim().replace("\\s".toRegex(), "")
    if (trimmed.isEmpty()) return null

    var normalized = trimmed
    when {
        trimmed.contains(',') && trimmed.contains('.') -> {
            val lastComma = trimmed.lastIndexOf(',')
            val lastDot = trimmed.lastIndexOf('.')
            normalized = if (lastComma > lastDot) {
                trimmed.replace(".", "").replace(',', '.')
            } else {
                trimmed.replace(",", "")
            }
        }
        trimmed.contains(',') -> {
            val parts = trimmed.split(',')
            normalized = if (parts.size == 2 && parts[1].length <= 2) {
                parts[0].replace(".", "") + "." + parts[1]
            } else {
                trimmed.replace(",", "")
            }
        }
        Regex("""^\d{1,3}(\.\d{3})+$""").matches(trimmed) -> {
            normalized = trimmed.replace(".", "")
        }
    }

    val value = normalized.toBigDecimalOrNull() ?: return null
    if (value <= BigDecimal.ZERO) return null
    return value.setScale(2, RoundingMode.HALF_UP).toPlainString()
}
