package com.furkansogutma.app.feature.order.domain.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.order.domain.model.CheckoutValidation
import com.furkansogutma.app.feature.order.domain.model.CouponValidation
import com.furkansogutma.app.feature.order.domain.model.CreateOrderInput
import com.furkansogutma.app.feature.order.domain.model.Order

interface OrderRepository {
    suspend fun validateCheckout(input: CreateOrderInput): Result<CheckoutValidation>
    suspend fun validateCoupon(code: String): Result<CouponValidation>
    suspend fun createOrder(input: CreateOrderInput): Result<Order>
    suspend fun getOrders(page: Int = 1): Result<List<Order>>
    suspend fun getOrder(id: String): Result<Order>
    suspend fun cancelOrder(id: String): Result<Order>
}
