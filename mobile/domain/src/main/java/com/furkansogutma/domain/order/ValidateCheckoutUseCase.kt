package com.furkansogutma.domain.order

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class ValidateCheckoutUseCase @Inject constructor(
    private val repository: OrderRepository,
) {
    suspend operator fun invoke(input: CreateOrderInput): Result<CheckoutValidation> =
        repository.validateCheckout(input)
}
