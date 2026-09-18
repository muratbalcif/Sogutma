package com.furkansogutma.app.feature.cart.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Test
import com.furkansogutma.app.feature.cart.domain.model.Cart
import com.furkansogutma.app.feature.cart.domain.repository.CartRepository

class AddToCartUseCaseTest {
    @Test
    fun `adds item via repository`() = runTest {
        val repo = mockk<CartRepository>()
        val cart = Cart("c", emptyList(), "0", "0", "0", "TRY")
        coEvery { repo.addItem("p1", 2) } returns Result.Success(cart)
        val result = AddToCartUseCase(repo)("p1", 2)
        assertThat(result).isInstanceOf(Result.Success::class.java)
    }
}
