package com.furkansogutma.app.feature.order.presentation

import com.furkansogutma.app.feature.order.domain.model.Order
import com.furkansogutma.app.feature.order.domain.model.OrderItem
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OrderDetailBankTransferCtaTest {
    @Test
    fun showsCtaForPendingAndPartiallyPaidBankTransfer() {
        assertTrue(
            sample(
                status = "PENDING",
                paymentStatus = "PENDING",
                paymentMethod = "BANK_TRANSFER",
            ).showsBankTransferPayCta(),
        )
        assertTrue(
            sample(
                status = "PENDING",
                paymentStatus = "PARTIALLY_PAID",
                paymentMethod = "BANK_TRANSFER",
            ).showsBankTransferPayCta(),
        )
    }

    @Test
    fun hidesCtaWhenPaidCancelledReturnedOrNonBankTransfer() {
        assertFalse(
            sample(
                status = "CONFIRMED",
                paymentStatus = "PAID",
                paymentMethod = "BANK_TRANSFER",
            ).showsBankTransferPayCta(),
        )
        assertFalse(
            sample(
                status = "CANCELLED",
                paymentStatus = "PENDING",
                paymentMethod = "BANK_TRANSFER",
            ).showsBankTransferPayCta(),
        )
        assertFalse(
            sample(
                status = "RETURNED",
                paymentStatus = "PARTIALLY_PAID",
                paymentMethod = "BANK_TRANSFER",
            ).showsBankTransferPayCta(),
        )
        assertFalse(
            sample(
                status = "PENDING",
                paymentStatus = "PENDING",
                paymentMethod = "CREDIT_CARD",
            ).showsBankTransferPayCta(),
        )
    }

    @Test
    fun hidesCtaWhenRemainingIsZero() {
        assertFalse(
            sample(
                status = "PENDING",
                paymentStatus = "PARTIALLY_PAID",
                paymentMethod = "BANK_TRANSFER",
                paymentRemainingAmount = "0.00",
            ).showsBankTransferPayCta(),
        )
    }

    private fun sample(
        status: String,
        paymentStatus: String?,
        paymentMethod: String?,
        paymentRemainingAmount: String? = null,
    ) = Order(
        id = "o1",
        orderNumber = "FS-1",
        status = status,
        paymentStatus = paymentStatus,
        paymentMethod = paymentMethod,
        total = "100",
        subtotal = "100",
        taxAmount = "0",
        discountAmount = "0",
        shippingAmount = "0",
        currency = "TRY",
        createdAt = "2026-01-01",
        items = listOf(OrderItem("i1", null, "Item", "SKU", 1, "100", "100")),
        statusHistory = emptyList(),
        shippingSummary = null,
        paymentRemainingAmount = paymentRemainingAmount,
    )
}
