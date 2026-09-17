package com.furkansogutma.feature.account

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
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
        val order = Order(
            id = "o1",
            orderNumber = "FS-100",
            status = "SHIPPED",
            paymentStatus = "PAID",
            paymentMethod = "BANK_TRANSFER",
            total = "250",
            subtotal = "250",
            taxAmount = "0",
            discountAmount = "0",
            shippingAmount = "0",
            currency = "TRY",
            createdAt = "2026-01-01",
            items = listOf(OrderItem("i1", null, "Kompresör", "SKU", 1, "250", "250")),
            statusHistory = listOf(
                OrderStatusHistory("h1", "PENDING", null, "2026-01-01"),
                OrderStatusHistory("h2", "SHIPPED", "kargoya verildi", "2026-01-02"),
            ),
            shippingSummary = "Ali Veli, Cadde 1, Kadıköy/İstanbul",
            shipping = OrderShipping(
                provider = "MANUAL",
                trackingNumber = "TRK-9",
                trackingUrl = "https://example.com/TRK-9",
                status = "SHIPPED",
            ),
            canCancel = false,
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
    }
}
