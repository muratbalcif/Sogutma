package com.furkansogutma.app.feature.home.presentation

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.auth.domain.repository.AuthRepository
import com.furkansogutma.app.feature.auth.domain.model.AuthState
import com.furkansogutma.app.feature.cart.domain.usecase.CartBadgeStore
import com.furkansogutma.app.feature.cart.domain.usecase.RefreshCartBadgeUseCase
import com.furkansogutma.app.feature.home.domain.usecase.GetHomeCatalogUseCase
import com.furkansogutma.app.feature.home.domain.usecase.HomeCatalog
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
class HomeViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before fun setup() = Dispatchers.setMain(dispatcher)
    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loads home catalog success`() = runTest {
        val getHome = mockk<GetHomeCatalogUseCase>()
        val refresh = mockk<RefreshCartBadgeUseCase>(relaxed = true)
        val auth = mockk<AuthRepository>()
        every { auth.authState } returns MutableStateFlow(AuthState.Guest)
        coEvery { getHome() } returns Result.Success(
            HomeCatalog(emptyList(), emptyList(), emptyList(), emptyList(), emptyList(), emptyList()),
        )
        val vm = HomeViewModel(getHome, refresh, auth, CartBadgeStore())
        advanceUntilIdle()
        assertThat(vm.uiState.value).isInstanceOf(HomeUiState.Success::class.java)
    }
}
