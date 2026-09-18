package com.furkansogutma.app.feature.auth.data.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.core.datastore.TokenStorage
import com.furkansogutma.app.core.network.api.AuthApi
import com.furkansogutma.app.core.network.dto.AuthTokensDto
import com.furkansogutma.app.core.network.dto.UserDto
import com.furkansogutma.app.core.network.error.NetworkErrorMapper
import com.furkansogutma.app.core.network.SafeApiCall
import com.google.common.truth.Truth.assertThat
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Test

class AuthRepositoryImplTest {
    private val api = mockk<AuthApi>()
    private val tokenStorage = mockk<TokenStorage>(relaxed = true)
    private val safeApiCall = SafeApiCall(NetworkErrorMapper(Moshi.Builder().add(KotlinJsonAdapterFactory()).build()))
    private val repo = AuthRepositoryImpl(api, tokenStorage, safeApiCall)

    @Test
    fun `login stores tokens`() = runTest {
        coEvery { api.login(any()) } returns AuthTokensDto(
            user = UserDto("1", "a@b.com", "A", "B", null, "INDIVIDUAL", "ACTIVE"),
            accessToken = "access",
            refreshToken = "refresh",
        )
        val result = repo.login("a@b.com", "Password1")
        assertThat(result).isInstanceOf(Result.Success::class.java)
        coVerify { tokenStorage.saveTokens("access", "refresh") }
    }

    @Test
    fun `updateProfile returns user`() = runTest {
        coEvery { api.updateProfile(any()) } returns UserDto(
            "1",
            "a@b.com",
            "Ali",
            "B",
            "+90555",
            "INDIVIDUAL",
            "ACTIVE",
        )
        val result = repo.updateProfile(
            com.furkansogutma.app.feature.auth.domain.repository.UpdateProfileInput("Ali", "B", "+90555"),
        )
        assertThat(result).isInstanceOf(Result.Success::class.java)
        val user = (result as Result.Success).data
        assertThat(user.firstName).isEqualTo("Ali")
        assertThat(user.phone).isEqualTo("+90555")
    }
}
