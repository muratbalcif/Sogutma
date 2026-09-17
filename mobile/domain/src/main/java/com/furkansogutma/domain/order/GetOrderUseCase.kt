package com.furkansogutma.domain.order

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class GetOrderUseCase @Inject constructor(private val repository: OrderRepository) {
    suspend operator fun invoke(id: String): Result<Order> = repository.getOrder(id)
}
