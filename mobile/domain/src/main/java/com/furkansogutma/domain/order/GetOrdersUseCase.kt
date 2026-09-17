package com.furkansogutma.domain.order

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class GetOrdersUseCase @Inject constructor(private val repository: OrderRepository) {
    suspend operator fun invoke(page: Int = 1): Result<List<Order>> = repository.getOrders(page)
}
