package com.furkansogutma.domain.order

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class ValidateCouponUseCase @Inject constructor(
    private val repository: OrderRepository,
) {
    suspend operator fun invoke(code: String): Result<CouponValidation> =
        repository.validateCoupon(code.trim())
}
