package com.furkansogutma.data.order

import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.network.api.CommerceApi
import com.furkansogutma.core.network.dto.CreateOrderRequestDto
import com.furkansogutma.core.network.dto.CreatePaymentRequestDto
import com.furkansogutma.data.mapper.toDomain
import com.furkansogutma.data.remote.SafeApiCall
import com.furkansogutma.domain.order.CreateOrderInput
import com.furkansogutma.domain.order.Order
import com.furkansogutma.domain.order.OrderRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OrderRepositoryImpl @Inject constructor(
    private val api: CommerceApi,
    private val safeApiCall: SafeApiCall,
) : OrderRepository {
    override suspend fun createOrder(input: CreateOrderInput): Result<Order> = safeApiCall {
        val order = api.createOrder(
            CreateOrderRequestDto(
                shippingAddressId = input.shippingAddressId,
                billingAddressId = input.billingAddressId,
                customerNote = input.note,
                couponCode = input.couponCode,
            ),
        )
        // v1: payment is created with the order as BANK_TRANSFER; this call is idempotent.
        api.createPayment(order.id, CreatePaymentRequestDto(method = "BANK_TRANSFER"))
        api.order(order.id).toDomain()
    }

    override suspend fun getOrders(page: Int): Result<List<Order>> =
        safeApiCall { api.orders(page).items.map { it.toDomain() } }

    override suspend fun getOrder(id: String): Result<Order> =
        safeApiCall { api.order(id).toDomain() }

    override suspend fun cancelOrder(id: String): Result<Order> =
        safeApiCall { api.cancelOrder(id).toDomain() }
}
