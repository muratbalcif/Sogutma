package com.furkansogutma.app.feature.cart.data.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.core.network.api.CommerceApi
import com.furkansogutma.app.core.network.dto.AddCartItemRequestDto
import com.furkansogutma.app.core.network.dto.UpdateCartItemRequestDto
import com.furkansogutma.app.data.mapper.toDomain
import com.furkansogutma.app.core.network.SafeApiCall
import com.furkansogutma.app.feature.cart.domain.model.Cart
import com.furkansogutma.app.feature.cart.domain.repository.CartRepository
import com.furkansogutma.app.feature.cart.domain.model.CartValidation
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CartRepositoryImpl @Inject constructor(
    private val api: CommerceApi,
    private val safeApiCall: SafeApiCall,
) : CartRepository {
    override suspend fun getCart(): Result<Cart> = safeApiCall { api.cart().toDomain() }
    override suspend fun addItem(productId: String, quantity: Int): Result<Cart> =
        safeApiCall { api.addCartItem(AddCartItemRequestDto(productId, quantity)).toDomain() }
    override suspend fun updateItem(productId: String, quantity: Int): Result<Cart> =
        safeApiCall { api.updateCartItem(productId, UpdateCartItemRequestDto(quantity)).toDomain() }
    override suspend fun removeItem(productId: String): Result<Cart> =
        safeApiCall { api.removeCartItem(productId).toDomain() }
    override suspend fun validate(): Result<CartValidation> =
        safeApiCall { api.validateCart().toDomain() }
}
