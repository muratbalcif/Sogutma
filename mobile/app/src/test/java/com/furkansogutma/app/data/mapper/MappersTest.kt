package com.furkansogutma.app.data.mapper

import com.furkansogutma.app.core.network.dto.BrandDto
import com.furkansogutma.app.core.network.dto.CategoryDto
import com.furkansogutma.app.core.network.dto.MoneyDto
import com.furkansogutma.app.core.network.dto.NotificationDataDto
import com.furkansogutma.app.core.network.dto.NotificationDto
import com.furkansogutma.app.core.network.dto.OrderDto
import com.furkansogutma.app.core.network.dto.OrderStatusHistoryDto
import com.furkansogutma.app.core.network.dto.PaymentDto
import com.furkansogutma.app.core.network.dto.ProductDto
import com.furkansogutma.app.core.network.dto.ShippingDto
import com.furkansogutma.app.core.network.dto.StockDto
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class MappersTest {
    @Test
    fun `product dto maps resolved price without recalculation`() {
        val dto = ProductDto(
            id = "1",
            sku = "SKU-1",
            name = "Kompresör",
            slug = "kompresor",
            brand = BrandDto("b", "Marka", "marka"),
            category = CategoryDto("c", "Kat", "kat"),
            price = MoneyDto("1999.90", "TRY", "CAMPAIGN"),
            compareAtPrice = MoneyDto("2499.90", "TRY", "RETAIL"),
            stock = StockDto(true, 5),
            onCampaign = true,
        )
        val domain = dto.toDomain()
        assertThat(domain.price?.amount).isEqualTo("1999.90")
        assertThat(domain.compareAtPrice?.amount).isEqualTo("2499.90")
        assertThat(domain.onCampaign).isTrue()
    }

    @Test
    fun `order dto maps shipping tracking and canCancel from API`() {
        val dto = OrderDto(
            id = "o1",
            orderNumber = "FS-1",
            status = "SHIPPED",
            currency = "TRY",
            subtotal = "100",
            discountAmount = "0",
            taxAmount = "0",
            shippingAmount = "0",
            totalAmount = "100",
            statusHistory = listOf(
                OrderStatusHistoryDto("h1", null, "SHIPPED", "kargoda", "2026-01-02"),
            ),
            payment = PaymentDto("p1", "PAID", "100", "TRY", method = "BANK_TRANSFER"),
            shipping = ShippingDto(
                provider = "MANUAL",
                trackingNumber = "TRK-1",
                trackingUrl = "https://carrier.example/TRK-1",
                status = "SHIPPED",
            ),
            canCancel = false,
            createdAt = "2026-01-01",
        )
        val order = dto.toDomain()
        assertThat(order.shipping?.trackingNumber).isEqualTo("TRK-1")
        assertThat(order.shipping?.trackingUrl).isEqualTo("https://carrier.example/TRK-1")
        assertThat(order.canCancel).isFalse()
        assertThat(order.statusHistory).hasSize(1)
        assertThat(order.paymentStatus).isEqualTo("PAID")
    }

    @Test
    fun `notification dto maps entity deep link fields`() {
        val dto = NotificationDto(
            id = "n1",
            type = "ORDER_SHIPPED",
            title = "Kargoda",
            body = "Sipariş kargoda",
            data = NotificationDataDto(orderId = "o1", productSlug = null),
            entityType = "ORDER",
            entityId = "o1",
            readAt = null,
            createdAt = "2026-01-01",
        )
        val n = dto.toDomain()
        assertThat(n.orderId).isEqualTo("o1")
        assertThat(n.isUnread).isTrue()
    }
}
