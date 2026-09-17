package com.furkansogutma.data.cart

import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.network.api.CommerceApi
import com.furkansogutma.core.network.dto.AddCartItemRequestDto
import com.furkansogutma.core.network.dto.UpdateCartItemRequestDto
import com.furkansogutma.data.mapper.toDomain
import com.furkansogutma.data.remote.SafeApiCall
import com.furkansogutma.domain.cart.Cart
import com.furkansogutma.domain.cart.CartRepository
import com.furkansogutma.domain.cart.CartValidation
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
