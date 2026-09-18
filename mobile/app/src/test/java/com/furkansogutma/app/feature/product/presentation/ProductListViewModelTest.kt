package com.furkansogutma.app.feature.product.presentation

import androidx.lifecycle.SavedStateHandle
import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.category.domain.repository.CategoryRepository
import com.furkansogutma.app.feature.product.domain.model.ProductPage
import com.furkansogutma.app.feature.product.domain.repository.ProductRepository
import com.furkansogutma.app.feature.product.domain.usecase.GetProductsUseCase
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
        val productRepository = mockk<ProductRepository>()
        val categoryRepository = mockk<CategoryRepository>()
        coEvery { useCase(any()) } returns Result.Success(ProductPage(emptyList(), 1, 1, 0))
        coEvery { productRepository.getBrands() } returns Result.Success(emptyList())
        coEvery { categoryRepository.getCategories() } returns Result.Success(emptyList())
        val vm = ProductListViewModel(
            useCase,
            productRepository,
            categoryRepository,
            SavedStateHandle(),
        )
        advanceUntilIdle()
        assertThat(vm.uiState.value.isLoading).isFalse()
        assertThat(vm.uiState.value.products).isEmpty()
    }
}
