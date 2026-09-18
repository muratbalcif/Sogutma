package com.furkansogutma.app.feature.checkout.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import javax.inject.Inject
import com.furkansogutma.app.feature.order.domain.model.CouponValidation
import com.furkansogutma.app.feature.order.domain.repository.OrderRepository

class ValidateCouponUseCase @Inject constructor(
    private val repository: OrderRepository,
) {
    suspend operator fun invoke(code: String): Result<CouponValidation> =
        repository.validateCoupon(code.trim())
}
