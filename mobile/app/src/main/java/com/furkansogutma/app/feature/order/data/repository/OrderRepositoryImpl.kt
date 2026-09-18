package com.furkansogutma.app.feature.order.data.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.core.network.api.CommerceApi
import com.furkansogutma.app.core.network.dto.CheckoutValidateRequestDto
import com.furkansogutma.app.core.network.dto.CreateOrderRequestDto
import com.furkansogutma.app.core.network.dto.CreatePaymentRequestDto
import com.furkansogutma.app.core.network.dto.ValidateCouponRequestDto
import com.furkansogutma.app.data.mapper.toDomain
import com.furkansogutma.app.core.network.SafeApiCall
import com.furkansogutma.app.feature.order.domain.model.CheckoutValidation
import com.furkansogutma.app.feature.order.domain.model.CouponValidation
import com.furkansogutma.app.feature.order.domain.model.CreateOrderInput
import com.furkansogutma.app.feature.order.domain.model.Order
import com.furkansogutma.app.feature.order.domain.repository.OrderRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OrderRepositoryImpl @Inject constructor(
    private val api: CommerceApi,
    private val safeApiCall: SafeApiCall,
) : OrderRepository {
    override suspend fun validateCheckout(input: CreateOrderInput): Result<CheckoutValidation> =
        safeApiCall {
            api.validateCheckout(
                CheckoutValidateRequestDto(
                    shippingAddressId = input.shippingAddressId,
                    billingAddressId = input.billingAddressId,
                    customerNote = input.note,
                    couponCode = input.couponCode,
                ),
            ).toDomain()
        }

    override suspend fun validateCoupon(code: String): Result<CouponValidation> =
        safeApiCall {
            val dto = api.validateCoupon(ValidateCouponRequestDto(code = code))
            CouponValidation(
                valid = dto.valid,
                code = dto.code,
                message = dto.message,
                discountAmount = dto.discountAmount,
            )
        }

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
