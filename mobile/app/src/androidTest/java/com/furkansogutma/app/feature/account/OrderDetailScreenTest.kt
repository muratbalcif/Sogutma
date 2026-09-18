package com.furkansogutma.app.feature.account

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import com.furkansogutma.core.designsystem.theme.FurkanSogutmaTheme
import com.furkansogutma.domain.order.Order
import com.furkansogutma.domain.order.OrderItem
import com.furkansogutma.domain.order.OrderShipping
import com.furkansogutma.domain.order.OrderStatusHistory
import org.junit.Rule
import org.junit.Test

class OrderDetailScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun showsShippingTimelineAndTracking() {
        val order = sampleOrder(
            status = "SHIPPED",
            paymentStatus = "PAID",
            paymentMethod = "BANK_TRANSFER",
            canCancel = false,
            shipping = OrderShipping(
                provider = "MANUAL",
                trackingNumber = "TRK-9",
                trackingUrl = "https://example.com/TRK-9",
                status = "SHIPPED",
            ),
            statusHistory = listOf(
                OrderStatusHistory("h1", "PENDING", null, "2026-01-01"),
                OrderStatusHistory("h2", "SHIPPED", "kargoya verildi", "2026-01-02"),
            ),
        )
        composeRule.setContent {
            FurkanSogutmaTheme {
                OrderDetailContent(order = order)
            }
        }
        composeRule.onNodeWithText("Kargo").assertIsDisplayed()
        composeRule.onNodeWithText("Takip no: TRK-9").assertIsDisplayed()
        composeRule.onNodeWithText("Kargoyu takip et").assertIsDisplayed()
        composeRule.onNodeWithText("Sipariş geçmişi").assertIsDisplayed()
        composeRule.onNodeWithText("2026-01-02: SHIPPED").assertIsDisplayed()
        composeRule.onNodeWithText("Ödeme durumu: PAID").assertIsDisplayed()
        composeRule.onAllNodesWithText("Havale / EFT ile Öde").assertCountEquals(0)
    }

    @Test
    fun showsBankTransferPayCtaWhenUnpaid() {
        val order = sampleOrder(
            status = "PENDING",
            paymentStatus = "PENDING",
            paymentMethod = "BANK_TRANSFER",
            paymentRemainingAmount = "9000.00",
        )
        composeRule.setContent {
            FurkanSogutmaTheme {
                OrderDetailContent(order = order)
            }
        }
        composeRule.onNodeWithText("Havale / EFT ile Öde").assertIsDisplayed()
        composeRule.onNodeWithText("Kalan tutar: 9000.00 TRY").assertIsDisplayed()
    }

    @Test
    fun showsBankTransferPayCtaWhenPartiallyPaid() {
        val order = sampleOrder(
            status = "PENDING",
            paymentStatus = "PARTIALLY_PAID",
            paymentMethod = "BANK_TRANSFER",
            paymentApprovedTotal = "18000.00",
            paymentRemainingAmount = "9000.00",
        )
        composeRule.setContent {
            FurkanSogutmaTheme {
                OrderDetailContent(order = order)
            }
        }
        composeRule.onNodeWithText("Havale / EFT ile Öde").assertIsDisplayed()
    }

    private fun sampleOrder(
        status: String,
        paymentStatus: String?,
        paymentMethod: String?,
        canCancel: Boolean = true,
        paymentApprovedTotal: String? = null,
        paymentRemainingAmount: String? = null,
        shipping: OrderShipping? = null,
        statusHistory: List<OrderStatusHistory> = emptyList(),
    ) = Order(
        id = "o1",
        orderNumber = "FS-100",
        status = status,
        paymentStatus = paymentStatus,
        paymentMethod = paymentMethod,
        total = "27000.00",
        subtotal = "27000.00",
        taxAmount = "0",
        discountAmount = "0",
        shippingAmount = "0",
        currency = "TRY",
        createdAt = "2026-01-01",
        items = listOf(OrderItem("i1", null, "Kompresör", "SKU", 1, "27000.00", "27000.00")),
        statusHistory = statusHistory,
        shippingSummary = "Ali Veli, Cadde 1, Kadıköy/İstanbul",
        shipping = shipping,
        canCancel = canCancel,
        paymentApprovedTotal = paymentApprovedTotal,
        paymentRemainingAmount = paymentRemainingAmount,
    )
}
