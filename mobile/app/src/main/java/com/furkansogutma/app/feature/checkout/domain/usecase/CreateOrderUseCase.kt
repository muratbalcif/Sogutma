package com.furkansogutma.app.feature.checkout.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import javax.inject.Inject
import com.furkansogutma.app.feature.order.domain.model.CreateOrderInput
import com.furkansogutma.app.feature.order.domain.model.Order
import com.furkansogutma.app.feature.order.domain.repository.OrderRepository

class CreateOrderUseCase @Inject constructor(private val repository: OrderRepository) {
    suspend operator fun invoke(input: CreateOrderInput): Result<Order> = repository.createOrder(input)
}
