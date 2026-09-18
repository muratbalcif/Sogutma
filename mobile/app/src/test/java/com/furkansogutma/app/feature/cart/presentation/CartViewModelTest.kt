package com.furkansogutma.app.feature.cart.presentation

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.cart.domain.model.Cart
import com.furkansogutma.app.feature.cart.domain.usecase.CartBadgeStore
import com.furkansogutma.app.feature.cart.domain.repository.CartRepository
import com.furkansogutma.app.feature.cart.domain.usecase.GetCartUseCase
import com.furkansogutma.app.feature.cart.domain.usecase.UpdateCartItemUseCase
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
class CartViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before fun setup() = Dispatchers.setMain(dispatcher)
    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loads empty cart`() = runTest {
        val getCart = mockk<GetCartUseCase>()
        val update = mockk<UpdateCartItemUseCase>()
        val repo = mockk<CartRepository>()
        coEvery { getCart() } returns Result.Success(
            Cart("1", emptyList(), "0", "0", "0", "TRY"),
        )
        val vm = CartViewModel(getCart, update, repo, CartBadgeStore())
        advanceUntilIdle()
        assertThat(vm.uiState.value).isInstanceOf(CartUiState.Success::class.java)
    }
}
