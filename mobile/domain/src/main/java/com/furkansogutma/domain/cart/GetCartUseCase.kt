package com.furkansogutma.domain.cart

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class GetCartUseCase @Inject constructor(private val repository: CartRepository) {
    suspend operator fun invoke(): Result<Cart> = repository.getCart()
}
