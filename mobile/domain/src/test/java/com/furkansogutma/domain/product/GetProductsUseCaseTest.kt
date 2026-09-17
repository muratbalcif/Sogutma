package com.furkansogutma.domain.product

import com.furkansogutma.core.common.result.Result
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Test

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
