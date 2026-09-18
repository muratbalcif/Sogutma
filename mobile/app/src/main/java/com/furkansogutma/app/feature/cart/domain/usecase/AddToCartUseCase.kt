package com.furkansogutma.app.feature.cart.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import javax.inject.Inject
import com.furkansogutma.app.feature.cart.domain.model.Cart
import com.furkansogutma.app.feature.cart.domain.repository.CartRepository

class AddToCartUseCase @Inject constructor(private val repository: CartRepository) {
    suspend operator fun invoke(productId: String, quantity: Int = 1): Result<Cart> =
        repository.addItem(productId, quantity)
}
