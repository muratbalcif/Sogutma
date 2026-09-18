package com.furkansogutma.app.feature.auth.domain.usecase

import com.furkansogutma.app.core.common.result.AppError
import com.furkansogutma.app.core.common.result.Result
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Test
import com.furkansogutma.app.feature.auth.domain.model.AuthUser
import com.furkansogutma.app.feature.auth.domain.repository.AuthRepository

class LoginUseCaseTest {
    private val repository = mockk<AuthRepository>()
    private val useCase = LoginUseCase(repository)

    @Test
    fun `blank credentials return validation error`() = runTest {
        val result = useCase("", "")
        assertThat(result).isInstanceOf(Result.Error::class.java)
        assertThat((result as Result.Error).error).isInstanceOf(AppError.Validation::class.java)
    }

    @Test
    fun `delegates to repository`() = runTest {
        val user = AuthUser("1", "a@b.com", "A", "B", null, "INDIVIDUAL", "ACTIVE")
        coEvery { repository.login("a@b.com", "Password1") } returns Result.Success(user)
        val result = useCase("a@b.com", "Password1")
        assertThat((result as Result.Success).data).isEqualTo(user)
    }
}
