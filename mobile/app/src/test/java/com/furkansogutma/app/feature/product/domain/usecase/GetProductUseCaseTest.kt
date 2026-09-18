package com.furkansogutma.app.feature.product.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Test
import com.furkansogutma.app.feature.product.domain.model.Money
import com.furkansogutma.app.feature.product.domain.model.Product
import com.furkansogutma.app.feature.product.domain.repository.ProductRepository

class GetProductUseCaseTest {
    @Test
    fun `returns product by slug`() = runTest {
        val repo = mockk<ProductRepository>()
        val product = Product(
            id = "1", sku = "SKU", barcode = null, name = "P", slug = "p",
            description = null, brandName = "B", brandSlug = "b",
            categoryName = "C", categorySlug = "c", images = emptyList(),
            price = Money("10", "TRY"), compareAtPrice = null,
            stockAvailable = true, stockQuantity = 1, onCampaign = false,
        )
        coEvery { repo.getProductBySlug("p") } returns Result.Success(product)
        val result = GetProductUseCase(repo)("p")
        assertThat((result as Result.Success).data.slug).isEqualTo("p")
    }
}
