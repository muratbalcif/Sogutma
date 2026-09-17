package com.furkansogutma.domain.cart

data class Cart(
    val id: String,
    val items: List<CartItem>,
    val subtotal: String,
    val discountAmount: String,
    val total: String,
    val currency: String,
)

data class CartItem(
    val productId: String,
    val quantity: Int,
    val name: String,
    val slug: String,
    val sku: String,
    val imageUrl: String?,
    val unitPrice: String?,
    val lineTotal: String?,
    val currency: String?,
    val available: Boolean,
    val availableQuantity: Int,
    val issueCode: String?,
)

data class CartValidation(
    val valid: Boolean,
    val issues: List<CartIssue>,
)

data class CartIssue(
    val productId: String,
    val code: String,
    val message: String,
)
