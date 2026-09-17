package com.furkansogutma.domain.cart

import com.furkansogutma.core.common.result.Result

interface CartRepository {
    suspend fun getCart(): Result<Cart>
    suspend fun addItem(productId: String, quantity: Int): Result<Cart>
    suspend fun updateItem(productId: String, quantity: Int): Result<Cart>
    suspend fun removeItem(productId: String): Result<Cart>
    suspend fun validate(): Result<CartValidation>
}
