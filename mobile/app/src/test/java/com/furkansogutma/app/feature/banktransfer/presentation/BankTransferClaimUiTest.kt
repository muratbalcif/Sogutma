package com.furkansogutma.app.feature.banktransfer.presentation

import org.junit.Assert.assertEquals
import org.junit.Test

class BankTransferClaimUiTest {
    @Test
    fun allowsClaimWhenUnpaidWithoutPending() {
        assertEquals(
            BankTransferClaimUiState.CanClaim,
            bankTransferClaimUiState(
                paymentMethod = "BANK_TRANSFER",
                paymentStatus = "PENDING",
                remainingAmount = "1000.00",
                pendingBankTransferId = null,
            ),
        )
    }

    @Test
    fun pendingReviewWhenPendingClaimExists() {
        assertEquals(
            BankTransferClaimUiState.PendingReview,
            bankTransferClaimUiState(
                paymentMethod = "BANK_TRANSFER",
                paymentStatus = "PARTIALLY_PAID",
                remainingAmount = "700.00",
                pendingBankTransferId = "n1",
            ),
        )
    }

    @Test
    fun hiddenWhenRemainingZeroOrPaid() {
        assertEquals(
            BankTransferClaimUiState.Hidden,
            bankTransferClaimUiState(
                paymentMethod = "BANK_TRANSFER",
                paymentStatus = "PARTIALLY_PAID",
                remainingAmount = "0.00",
                pendingBankTransferId = null,
            ),
        )
        assertEquals(
            BankTransferClaimUiState.Hidden,
            bankTransferClaimUiState(
                paymentMethod = "BANK_TRANSFER",
                paymentStatus = "PAID",
                remainingAmount = "0.00",
                pendingBankTransferId = null,
            ),
        )
    }
}
