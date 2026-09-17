package com.furkansogutma.feature.product

import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.cart.AddToCartUseCase
import com.furkansogutma.domain.cart.Cart
import com.furkansogutma.domain.cart.CartBadgeStore
import com.furkansogutma.domain.favorite.FavoriteRepository
import com.furkansogutma.domain.product.GetProductUseCase
import com.furkansogutma.domain.product.Money
import com.furkansogutma.domain.product.Product
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
import androidx.lifecycle.SavedStateHandle
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ProductDetailViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before fun setup() = Dispatchers.setMain(dispatcher)
    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loads product success`() = runTest {
        val product = Product(
            id = "1", sku = "SKU", barcode = null, name = "P", slug = "p",
            description = null, brandName = "B", brandSlug = "b",
            categoryName = "C", categorySlug = "c", images = emptyList(),
            price = Money("10", "TRY"), compareAtPrice = null,
            stockAvailable = true, stockQuantity = 2, onCampaign = false,
        )
        val getProduct = mockk<GetProductUseCase>()
        coEvery { getProduct("p") } returns Result.Success(product)
        val vm = ProductDetailViewModel(
            getProduct = getProduct,
            addToCart = mockk(relaxed = true),
            favorites = mockk(relaxed = true),
            accountRepository = mockk(relaxed = true),
            badgeStore = CartBadgeStore(),
            savedStateHandle = SavedStateHandle(mapOf("slug" to "p")),
        )
        advanceUntilIdle()
        assertThat(vm.uiState.value).isInstanceOf(ProductDetailUiState.Success::class.java)
    }
}
