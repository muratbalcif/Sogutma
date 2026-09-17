package com.furkansogutma.feature.checkout

import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.cart.Cart
import com.furkansogutma.domain.cart.GetCartUseCase
import com.furkansogutma.domain.order.CheckoutIssue
import com.furkansogutma.domain.order.CheckoutValidation
import com.furkansogutma.domain.order.CreateOrderUseCase
import com.furkansogutma.domain.order.Order
import com.furkansogutma.domain.order.ValidateCheckoutUseCase
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

    @Test
    fun `loads checkout data`() = runTest {
        val account = mockk<AccountRepository>()
        val getCart = mockk<GetCartUseCase>()
        coEvery { account.getAddresses() } returns Result.Success(emptyList())
        coEvery { account.getBankAccounts() } returns Result.Success(emptyList())
        coEvery { getCart() } returns Result.Success(Cart("1", emptyList(), "0", "0", "0", "TRY"))
        val vm = CheckoutViewModel(
            account,
            getCart,
            mockk(relaxed = true),
            mockk(relaxed = true),
        )
        advanceUntilIdle()
        assertThat(vm.ui.value.loading).isFalse()
        assertThat(vm.ui.value.total).isEqualTo("0 TRY")
    }

    @Test
    fun `does not create order when checkout validation fails`() = runTest {
        val account = mockk<AccountRepository>()
        val getCart = mockk<GetCartUseCase>()
        val validateCheckout = mockk<ValidateCheckoutUseCase>()
        val createOrder = mockk<CreateOrderUseCase>()
        coEvery { account.getAddresses() } returns Result.Success(emptyList())
        coEvery { account.getBankAccounts() } returns Result.Success(emptyList())
        coEvery { getCart() } returns Result.Success(Cart("1", emptyList(), "0", "0", "0", "TRY"))
        coEvery { validateCheckout(any()) } returns Result.Success(
            CheckoutValidation(
                valid = false,
                issues = listOf(CheckoutIssue("INSUFFICIENT_STOCK", "Stok yetersiz")),
            ),
        )

        val vm = CheckoutViewModel(account, getCart, validateCheckout, createOrder)
        advanceUntilIdle()
        vm.placeOrder("address-1")
        advanceUntilIdle()

        assertThat(vm.ui.value.error).contains("Stok yetersiz")
        assertThat(vm.ui.value.submitting).isFalse()
        coVerify(exactly = 0) { createOrder(any()) }
    }

    @Test
    fun `creates order after successful validation`() = runTest {
        val account = mockk<AccountRepository>()
        val getCart = mockk<GetCartUseCase>()
        val validateCheckout = mockk<ValidateCheckoutUseCase>()
        val createOrder = mockk<CreateOrderUseCase>()
        coEvery { account.getAddresses() } returns Result.Success(emptyList())
        coEvery { account.getBankAccounts() } returns Result.Success(emptyList())
        coEvery { getCart() } returns Result.Success(Cart("1", emptyList(), "100", "0", "100", "TRY"))
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

        val vm = CheckoutViewModel(account, getCart, validateCheckout, createOrder)
        advanceUntilIdle()
        vm.placeOrder("address-1")
        advanceUntilIdle()

        coVerify(exactly = 1) { createOrder(any()) }
        assertThat(vm.ui.value.error).isNull()
    }
}
