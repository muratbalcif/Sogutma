package com.furkansogutma.domain.order

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class CreateOrderUseCase @Inject constructor(private val repository: OrderRepository) {
    suspend operator fun invoke(input: CreateOrderInput): Result<Order> = repository.createOrder(input)
}
