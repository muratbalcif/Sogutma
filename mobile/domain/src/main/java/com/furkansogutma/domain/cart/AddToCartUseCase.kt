package com.furkansogutma.domain.cart

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class AddToCartUseCase @Inject constructor(private val repository: CartRepository) {
    suspend operator fun invoke(productId: String, quantity: Int = 1): Result<Cart> =
        repository.addItem(productId, quantity)
}
