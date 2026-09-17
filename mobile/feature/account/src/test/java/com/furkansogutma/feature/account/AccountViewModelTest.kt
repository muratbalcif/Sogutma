package com.furkansogutma.feature.account

import com.furkansogutma.domain.auth.AuthRepository
import com.furkansogutma.domain.auth.AuthState
import com.furkansogutma.domain.auth.LogoutUseCase
import com.furkansogutma.domain.cart.CartBadgeStore
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AccountViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before fun setup() = Dispatchers.setMain(dispatcher)
    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `logout clears badge and invokes callback`() = runTest {
        val auth = mockk<AuthRepository>()
        every { auth.authState } returns MutableStateFlow(AuthState.Guest)
        val logout = mockk<LogoutUseCase>()
        coEvery { logout() } returns com.furkansogutma.core.common.result.Result.Success(Unit)
        val badge = CartBadgeStore()
        badge.updateFromCart(
            com.furkansogutma.domain.cart.Cart("1", emptyList(), "0", "0", "10", "TRY"),
        )
        val vm = AccountViewModel(auth, logout, badge)
        var done = false
        vm.logout { done = true }
        advanceUntilIdle()
        assertThat(done).isTrue()
        assertThat(badge.count.value).isEqualTo(0)
    }
}
