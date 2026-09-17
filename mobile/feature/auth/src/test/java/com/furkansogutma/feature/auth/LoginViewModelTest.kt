package com.furkansogutma.feature.auth

import app.cash.turbine.test
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.auth.AuthUser
import com.furkansogutma.domain.auth.LoginUseCase
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LoginViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val loginUseCase = mockk<LoginUseCase>()
    private lateinit var viewModel: LoginViewModel

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        viewModel = LoginViewModel(loginUseCase)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `submit with blank email sets validation`() = runTest {
        viewModel.onEvent(LoginEvent.Submit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(viewModel.uiState.value.emailError).isNotNull()
    }

    @Test
    fun `successful login emits navigate effect`() = runTest {
        coEvery { loginUseCase(any(), any()) } returns Result.Success(
            AuthUser("1", "a@b.com", "A", "B", null, "INDIVIDUAL", "ACTIVE"),
        )
        viewModel.onEvent(LoginEvent.EmailChanged("a@b.com"))
        viewModel.onEvent(LoginEvent.PasswordChanged("Password1"))
        viewModel.effects.test {
            viewModel.onEvent(LoginEvent.Submit)
            dispatcher.scheduler.advanceUntilIdle()
            assertThat(awaitItem()).isEqualTo(LoginEffect.NavigateHome)
        }
    }
}
