package com.furkansogutma.domain.cart

import com.furkansogutma.core.common.result.Result
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Test

class AddToCartUseCaseTest {
    @Test
    fun `adds item via repository`() = runTest {
        val repo = mockk<CartRepository>()
        val cart = Cart("c", emptyList(), "0", null, null, "0", "TRY")
        coEvery { repo.addItem("p1", 2) } returns Result.Success(cart)
        val result = AddToCartUseCase(repo)("p1", 2)
        assertThat(result).isInstanceOf(Result.Success::class.java)
    }
}
