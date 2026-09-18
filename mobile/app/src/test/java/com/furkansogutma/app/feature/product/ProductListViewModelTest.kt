package com.furkansogutma.feature.product

import androidx.lifecycle.SavedStateHandle
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.product.GetProductsUseCase
import com.furkansogutma.domain.product.ProductPage
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
class ProductListViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before fun setup() = Dispatchers.setMain(dispatcher)
    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loads products on init`() = runTest {
        val useCase = mockk<GetProductsUseCase>()
        coEvery { useCase(any()) } returns Result.Success(ProductPage(emptyList(), 1, 1, 0))
        val vm = ProductListViewModel(useCase, SavedStateHandle())
        advanceUntilIdle()
        assertThat(vm.uiState.value.isLoading).isFalse()
        assertThat(vm.uiState.value.products).isEmpty()
    }
}
