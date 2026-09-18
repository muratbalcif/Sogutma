package com.furkansogutma.app.feature.banktransfer.presentation

/**
 * Shared claim CTA state for bank-transfer "Ödemeyi Yaptım" UX.
 * API 409 remains the source of truth; this only drives UI.
 */
enum class BankTransferClaimUiState {
    Hidden,
    PendingReview,
    CanClaim,
}

fun bankTransferClaimUiState(
    paymentMethod: String?,
    paymentStatus: String?,
    remainingAmount: String?,
    pendingBankTransferId: String?,
): BankTransferClaimUiState {
    if (paymentMethod != null && paymentMethod != "BANK_TRANSFER") {
        return BankTransferClaimUiState.Hidden
    }
    if (paymentStatus != "PENDING" && paymentStatus != "PARTIALLY_PAID") {
        return BankTransferClaimUiState.Hidden
    }
    val remaining = remainingAmount?.toBigDecimalOrNull()
    if (remaining == null || remaining <= java.math.BigDecimal.ZERO) {
        return BankTransferClaimUiState.Hidden
    }
    if (!pendingBankTransferId.isNullOrBlank()) {
        return BankTransferClaimUiState.PendingReview
    }
    return BankTransferClaimUiState.CanClaim
}
