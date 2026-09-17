package com.furkansogutma.feature.account

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import com.furkansogutma.domain.order.Order
import com.furkansogutma.domain.order.OrderItem
import com.furkansogutma.domain.order.OrderShipping
import com.furkansogutma.domain.order.OrderStatusHistory
import com.furkansogutma.domain.notification.AppNotification

class OrderNotificationUiModelTest {
    @Test
    fun orderDetailExposesShippingAndTimeline() {
        val order = Order(
            id = "o1",
            orderNumber = "FS-1",
            status = "SHIPPED",
            paymentStatus = "PAID",
            paymentMethod = "BANK_TRANSFER",
            total = "100",
            subtotal = "100",
            taxAmount = "0",
            discountAmount = "0",
            shippingAmount = "0",
            currency = "TRY",
            createdAt = "2026-01-01",
            items = listOf(
                OrderItem("i1", null, "Ürün", "SKU", 1, "100", "100"),
            ),
            statusHistory = listOf(
                OrderStatusHistory("h1", "PENDING", null, "t1"),
                OrderStatusHistory("h2", "SHIPPED", "kargoda", "t2"),
            ),
            shippingSummary = null,
            shipping = OrderShipping(
                provider = "MANUAL",
                trackingNumber = "TRK",
                trackingUrl = "https://example.com/track",
                status = "SHIPPED",
            ),
            canCancel = false,
        )
        assertEquals("TRK", order.shipping?.trackingNumber)
        assertTrue(order.shipping?.trackingUrl!!.startsWith("https://"))
        assertEquals(2, order.statusHistory.size)
    }

    @Test
    fun notificationMapsOrderDeepLinkFields() {
        val n = AppNotification(
            id = "n1",
            type = "ORDER_SHIPPED",
            title = "Kargoda",
            body = "Sipariş kargoda",
            entityType = "ORDER",
            entityId = "o1",
            productSlug = null,
            orderId = "o1",
            readAt = null,
            createdAt = "now",
        )
        assertTrue(n.isUnread)
        assertEquals("o1", n.orderId)
    }
}
