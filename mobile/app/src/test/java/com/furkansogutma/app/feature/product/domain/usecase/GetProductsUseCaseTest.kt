package com.furkansogutma.app.feature.product.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Test
import com.furkansogutma.app.feature.product.domain.model.ProductPage
import com.furkansogutma.app.feature.product.domain.model.ProductQuery
import com.furkansogutma.app.feature.product.domain.repository.ProductRepository

class GetProductsUseCaseTest {
    @Test
    fun `returns repository page`() = runTest {
        val repo = mockk<ProductRepository>()
        val page = ProductPage(emptyList(), 1, 1, 0)
        coEvery { repo.getProducts(any()) } returns Result.Success(page)
        val result = GetProductsUseCase(repo)(ProductQuery())
        assertThat((result as Result.Success).data).isEqualTo(page)
    }
}
