package com.furkansogutma.app.feature.checkout

import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.cart.Cart
import com.furkansogutma.domain.cart.GetCartUseCase
import com.furkansogutma.domain.order.CheckoutIssue
import com.furkansogutma.domain.order.CheckoutValidation
import com.furkansogutma.domain.order.CouponValidation
import com.furkansogutma.domain.order.CreateOrderUseCase
import com.furkansogutma.domain.order.Order
import com.furkansogutma.domain.order.ValidateCheckoutUseCase
import com.furkansogutma.domain.order.ValidateCouponUseCase
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CheckoutViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before fun setup() = Dispatchers.setMain(dispatcher)
    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(
        account: AccountRepository = mockk(),
        getCart: GetCartUseCase = mockk(),
        validateCheckout: ValidateCheckoutUseCase = mockk(relaxed = true),
        validateCoupon: ValidateCouponUseCase = mockk(relaxed = true),
        createOrder: CreateOrderUseCase = mockk(relaxed = true),
    ): CheckoutViewModel {
        coEvery { account.getAddresses() } returns Result.Success(emptyList())
        coEvery { account.getBankAccounts() } returns Result.Success(emptyList())
        coEvery { getCart() } returns Result.Success(Cart("1", emptyList(), "0", "0", "0", "TRY"))
        return CheckoutViewModel(account, getCart, validateCheckout, validateCoupon, createOrder)
    }

    @Test
    fun `loads checkout data`() = runTest {
        val viewModel = vm()
        advanceUntilIdle()
        assertThat(viewModel.ui.value.loading).isFalse()
        assertThat(viewModel.ui.value.total).isEqualTo("0 TRY")
    }

    @Test
    fun `does not create order when checkout validation fails`() = runTest {
        val validateCheckout = mockk<ValidateCheckoutUseCase>()
        val createOrder = mockk<CreateOrderUseCase>()
        coEvery { validateCheckout(any()) } returns Result.Success(
            CheckoutValidation(
                valid = false,
                issues = listOf(CheckoutIssue("INSUFFICIENT_STOCK", "Stok yetersiz")),
            ),
        )
        val viewModel = vm(validateCheckout = validateCheckout, createOrder = createOrder)
        advanceUntilIdle()
        viewModel.placeOrder("address-1")
        advanceUntilIdle()

        assertThat(viewModel.ui.value.error).contains("Stok yetersiz")
        assertThat(viewModel.ui.value.submitting).isFalse()
        coVerify(exactly = 0) { createOrder(any()) }
    }

    @Test
    fun `does not create order when coupon is invalid`() = runTest {
        val validateCoupon = mockk<ValidateCouponUseCase>()
        val createOrder = mockk<CreateOrderUseCase>()
        coEvery { validateCoupon(any()) } returns Result.Success(
            CouponValidation(valid = false, message = "Kupon süresi dolmuş"),
        )
        val viewModel = vm(validateCoupon = validateCoupon, createOrder = createOrder)
        advanceUntilIdle()
        viewModel.updateCouponCode("OLD10")
        viewModel.placeOrder("address-1")
        advanceUntilIdle()

        assertThat(viewModel.ui.value.error).contains("Kupon süresi dolmuş")
        assertThat(viewModel.ui.value.couponValid).isFalse()
        coVerify(exactly = 0) { createOrder(any()) }
    }

    @Test
    fun `applyCoupon shows server discount`() = runTest {
        val validateCoupon = mockk<ValidateCouponUseCase>()
        coEvery { validateCoupon("SAVE10") } returns Result.Success(
            CouponValidation(
                valid = true,
                message = "Kupon uygulandı",
                discountAmount = "25.00",
            ),
        )
        val viewModel = vm(validateCoupon = validateCoupon)
        advanceUntilIdle()
        viewModel.updateCouponCode("SAVE10")
        viewModel.applyCoupon()
        advanceUntilIdle()

        assertThat(viewModel.ui.value.couponValid).isTrue()
        assertThat(viewModel.ui.value.couponDiscount).isEqualTo("25.00")
        assertThat(viewModel.ui.value.couponMessage).contains("Kupon")
    }

    @Test
    fun `creates order after successful validation`() = runTest {
        val validateCheckout = mockk<ValidateCheckoutUseCase>()
        val createOrder = mockk<CreateOrderUseCase>()
        coEvery { validateCheckout(any()) } returns Result.Success(
            CheckoutValidation(valid = true, issues = emptyList(), total = "100.00", currency = "TRY"),
        )
        coEvery { createOrder(any()) } returns Result.Success(
            Order(
                id = "o1",
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
            ),
        )

        val viewModel = vm(validateCheckout = validateCheckout, createOrder = createOrder)
        advanceUntilIdle()
        viewModel.placeOrder("address-1")
        advanceUntilIdle()

        coVerify(exactly = 1) { createOrder(any()) }
        assertThat(viewModel.ui.value.error).isNull()
    }
}
