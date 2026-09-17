package com.furkansogutma.feature.checkout

import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.cart.Cart
import com.furkansogutma.domain.cart.GetCartUseCase
import com.furkansogutma.domain.order.CreateOrderUseCase
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
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
        coEvery { account.getSiteConfig() } returns Result.Error(
            com.furkansogutma.core.common.result.AppError.Network(),
        )
        coEvery { getCart() } returns Result.Success(Cart("1", emptyList(), "0", "0", "0", "TRY"))
        val vm = CheckoutViewModel(account, getCart, mockk(relaxed = true))
        advanceUntilIdle()
        assertThat(vm.ui.value.loading).isFalse()
        assertThat(vm.ui.value.total).isEqualTo("0 TRY")
    }
}
