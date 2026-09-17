package com.furkansogutma.domain.order

import com.furkansogutma.core.common.result.Result
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Test

class ValidateCheckoutUseCaseTest {
    @Test
    fun `returns validation from repository`() = runTest {
        val repo = mockk<OrderRepository>()
        val expected = CheckoutValidation(
            valid = false,
            issues = listOf(CheckoutIssue("EMPTY_CART", "Cart is empty")),
        )
        coEvery { repo.validateCheckout(any()) } returns Result.Success(expected)
        val result = ValidateCheckoutUseCase(repo)(
            CreateOrderInput(
                shippingAddressId = "a1",
                billingAddressId = "a1",
                paymentMethod = "BANK_TRANSFER",
            ),
        )
        assertThat((result as Result.Success).data.valid).isFalse()
        assertThat(result.data.issues.first().code).isEqualTo("EMPTY_CART")
    }
}

class CreateOrderUseCaseTest {
    @Test
    fun `creates order`() = runTest {
        val repo = mockk<OrderRepository>()
        val order = Order(
            id = "1",
            orderNumber = "FS-1",
            status = "PENDING",
            paymentStatus = "PENDING",
            paymentMethod = "BANK_TRANSFER",
            total = "100",
            subtotal = "100",
            taxAmount = "0",
            discountAmount = "0",
            shippingAmount = "0",
            currency = "TRY",
            createdAt = "2026-01-01",
            items = emptyList(),
            statusHistory = emptyList(),
            shippingSummary = null,
            shipping = null,
            canCancel = true,
        )
        coEvery { repo.createOrder(any()) } returns Result.Success(order)
        val result = CreateOrderUseCase(repo)(
            CreateOrderInput(
                shippingAddressId = "a1",
                billingAddressId = "a1",
                paymentMethod = "BANK_TRANSFER",
            ),
        )
        assertThat((result as Result.Success).data.orderNumber).isEqualTo("FS-1")
    }
}

class ValidateCouponUseCaseTest {
    @Test
    fun `returns coupon validation from repository`() = runTest {
        val repo = mockk<OrderRepository>()
        coEvery { repo.validateCoupon("SAVE10") } returns Result.Success(
            CouponValidation(valid = true, discountAmount = "10.00", message = "ok"),
        )
        val result = ValidateCouponUseCase(repo)(" SAVE10 ")
        assertThat((result as Result.Success).data.valid).isTrue()
        coVerify { repo.validateCoupon("SAVE10") }
    }
}
