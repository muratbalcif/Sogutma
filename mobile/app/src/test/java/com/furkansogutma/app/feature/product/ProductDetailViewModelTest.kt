package com.furkansogutma.app.feature.product

import androidx.lifecycle.SavedStateHandle
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.cart.AddToCartUseCase
import com.furkansogutma.domain.cart.CartBadgeStore
import com.furkansogutma.domain.favorite.FavoriteRepository
import com.furkansogutma.domain.product.GetProductUseCase
import com.furkansogutma.domain.product.Money
import com.furkansogutma.domain.product.Product
import com.furkansogutma.domain.product.ProductRepository
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
class ProductDetailViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before fun setup() = Dispatchers.setMain(dispatcher)
    @After fun tearDown() = Dispatchers.resetMain()

    private fun sampleProduct(slug: String = "p") = Product(
        id = "1", sku = "SKU", barcode = null, name = "P", slug = slug,
        description = null, brandName = "B", brandSlug = "b",
        categoryName = "C", categorySlug = "c", images = emptyList(),
        price = Money("10", "TRY"), compareAtPrice = null,
        stockAvailable = true, stockQuantity = 2, onCampaign = false,
    )

    @Test
    fun `loads product success`() = runTest {
        val getProduct = mockk<GetProductUseCase>()
        val products = mockk<ProductRepository>()
        coEvery { getProduct("p") } returns Result.Success(sampleProduct())
        coEvery { products.getRelatedProducts("p") } returns Result.Success(emptyList())
        val vm = ProductDetailViewModel(
            getProduct = getProduct,
            products = products,
            addToCart = mockk(relaxed = true),
            favorites = mockk(relaxed = true),
            accountRepository = mockk(relaxed = true),
            badgeStore = CartBadgeStore(),
            savedStateHandle = SavedStateHandle(mapOf("slug" to "p")),
        )
        advanceUntilIdle()
        assertThat(vm.uiState.value).isInstanceOf(ProductDetailUiState.Success::class.java)
        assertThat(vm.relatedState.value).isEqualTo(RelatedProductsUiState.Empty)
    }

    @Test
    fun `loads related products`() = runTest {
        val getProduct = mockk<GetProductUseCase>()
        val products = mockk<ProductRepository>()
        val related = sampleProduct("other")
        coEvery { getProduct("p") } returns Result.Success(sampleProduct())
        coEvery { products.getRelatedProducts("p") } returns Result.Success(listOf(related))
        val vm = ProductDetailViewModel(
            getProduct = getProduct,
            products = products,
            addToCart = mockk(relaxed = true),
            favorites = mockk(relaxed = true),
            accountRepository = mockk(relaxed = true),
            badgeStore = CartBadgeStore(),
            savedStateHandle = SavedStateHandle(mapOf("slug" to "p")),
        )
        advanceUntilIdle()
        val state = vm.relatedState.value as RelatedProductsUiState.Success
        assertThat(state.products).hasSize(1)
        assertThat(state.products.first().slug).isEqualTo("other")
    }

    @Test
    fun `related error exposes retryable state`() = runTest {
        val getProduct = mockk<GetProductUseCase>()
        val products = mockk<ProductRepository>()
        coEvery { getProduct("p") } returns Result.Success(sampleProduct())
        coEvery { products.getRelatedProducts("p") } returns Result.Error(
            com.furkansogutma.core.common.result.AppError.Network("network"),
        )
        val vm = ProductDetailViewModel(
            getProduct = getProduct,
            products = products,
            addToCart = mockk(relaxed = true),
            favorites = mockk(relaxed = true),
            accountRepository = mockk(relaxed = true),
            badgeStore = CartBadgeStore(),
            savedStateHandle = SavedStateHandle(mapOf("slug" to "p")),
        )
        advanceUntilIdle()
        assertThat(vm.relatedState.value).isInstanceOf(RelatedProductsUiState.Error::class.java)
    }
}
