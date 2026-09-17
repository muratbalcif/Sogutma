package com.furkansogutma.domain.cart

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class UpdateCartItemUseCase @Inject constructor(private val repository: CartRepository) {
    suspend operator fun invoke(productId: String, quantity: Int): Result<Cart> =
        if (quantity <= 0) repository.removeItem(productId)
        else repository.updateItem(productId, quantity)
}
