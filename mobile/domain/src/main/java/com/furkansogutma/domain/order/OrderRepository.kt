package com.furkansogutma.domain.order

import com.furkansogutma.core.common.result.Result

interface OrderRepository {
    suspend fun createOrder(input: CreateOrderInput): Result<Order>
    suspend fun getOrders(page: Int = 1): Result<List<Order>>
    suspend fun getOrder(id: String): Result<Order>
    suspend fun cancelOrder(id: String): Result<Order>
}
