package com.furkansogutma.domain.order

data class Order(
    val id: String,
    val orderNumber: String,
    val status: String,
    val paymentStatus: String?,
    val paymentMethod: String?,
    val total: String,
    val subtotal: String,
    val taxAmount: String,
    val discountAmount: String,
    val shippingAmount: String,
    val currency: String,
    val createdAt: String,
    val items: List<OrderItem>,
    val statusHistory: List<OrderStatusHistory>,
    val shippingSummary: String?,
    val shipping: OrderShipping? = null,
    val canCancel: Boolean = false,
)

data class OrderShipping(
    val provider: String?,
    val trackingNumber: String?,
    val trackingUrl: String?,
    val status: String?,
)

data class OrderItem(
    val id: String,
    val productId: String?,
    val name: String,
    val sku: String,
    val quantity: Int,
    val unitPrice: String,
    val total: String,
)

data class OrderStatusHistory(
    val id: String,
    val status: String,
    val note: String?,
    val createdAt: String,
)

data class CreateOrderInput(
    val shippingAddressId: String,
    val billingAddressId: String,
    val paymentMethod: String,
    val note: String? = null,
    val couponCode: String? = null,
)
