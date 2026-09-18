package com.furkansogutma.app.feature.cart.domain.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.cart.domain.model.Cart
import com.furkansogutma.app.feature.cart.domain.model.CartValidation

interface CartRepository {
    suspend fun getCart(): Result<Cart>
    suspend fun addItem(productId: String, quantity: Int): Result<Cart>
    suspend fun updateItem(productId: String, quantity: Int): Result<Cart>
    suspend fun removeItem(productId: String): Result<Cart>
    suspend fun validate(): Result<CartValidation>
}
