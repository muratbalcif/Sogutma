package com.furkansogutma.app.feature.order.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import javax.inject.Inject
import com.furkansogutma.app.feature.order.domain.model.Order
import com.furkansogutma.app.feature.order.domain.repository.OrderRepository

class GetOrderUseCase @Inject constructor(private val repository: OrderRepository) {
    suspend operator fun invoke(id: String): Result<Order> = repository.getOrder(id)
}
