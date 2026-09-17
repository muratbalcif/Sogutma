package com.furkansogutma.core.common.money

/**
 * Display-only money helpers. Do not use for financial calculations —
 * backend Decimal/string values are the source of truth.
 */
object MoneyFormatter {
    fun formatTry(amount: String): String {
        val normalized = amount.trim()
        return "$normalized ₺"
    }
}
