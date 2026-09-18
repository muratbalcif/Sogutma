package com.furkansogutma.app.feature.auth.data.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.core.datastore.TokenStorage
import com.furkansogutma.app.core.network.api.AuthApi
import com.furkansogutma.app.core.network.dto.ForgotPasswordRequestDto
import com.furkansogutma.app.core.network.dto.LoginRequestDto
import com.furkansogutma.app.core.network.dto.LogoutRequestDto
import com.furkansogutma.app.core.network.dto.RefreshTokenRequestDto
import com.furkansogutma.app.core.network.dto.RegisterRequestDto
import com.furkansogutma.app.core.network.dto.UpdateProfileRequestDto
import com.furkansogutma.app.data.mapper.toDomain
import com.furkansogutma.app.core.network.SafeApiCall
import com.furkansogutma.app.feature.auth.domain.repository.AuthRepository
import com.furkansogutma.app.feature.auth.domain.model.AuthState
import com.furkansogutma.app.feature.auth.domain.model.AuthUser
import com.furkansogutma.app.feature.auth.domain.repository.RegisterInput
import com.furkansogutma.app.feature.auth.domain.repository.UpdateProfileInput
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val api: AuthApi,
    private val tokenStorage: TokenStorage,
    private val safeApiCall: SafeApiCall,
) : AuthRepository {

    private val _authState = MutableStateFlow<AuthState>(AuthState.Loading)
    override val authState = _authState.asStateFlow()

    override suspend fun login(email: String, password: String): Result<AuthUser> {
        val result = safeApiCall {
            api.login(LoginRequestDto(email, password)).toDomain()
        }
        return when (result) {
            is Result.Success -> {
                tokenStorage.saveTokens(result.data.accessToken, result.data.refreshToken)
                _authState.value = AuthState.Authenticated(result.data.user)
                Result.Success(result.data.user)
            }
            is Result.Error -> result
        }
    }

    override suspend fun register(input: RegisterInput): Result<AuthUser> {
        val result = safeApiCall {
            api.register(
                RegisterRequestDto(
                    email = input.email,
                    password = input.password,
                    firstName = input.firstName,
                    lastName = input.lastName,
                    phone = input.phone,
                    userType = input.userType,
                    companyName = input.companyName,
                    taxNumber = input.taxNumber,
                    taxOffice = input.taxOffice,
                    identityNumber = input.identityNumber,
                ),
            ).toDomain()
        }
        return when (result) {
            is Result.Success -> {
                tokenStorage.saveTokens(result.data.accessToken, result.data.refreshToken)
                _authState.value = AuthState.Authenticated(result.data.user)
                Result.Success(result.data.user)
            }
            is Result.Error -> result
        }
    }

    override suspend fun logout(): Result<Unit> {
        val refresh = tokenStorage.getRefreshToken()
        if (!refresh.isNullOrBlank()) {
            safeApiCall { api.logout(LogoutRequestDto(refresh)) }
        }
        tokenStorage.clearTokens()
        _authState.value = AuthState.Guest
        return Result.Success(Unit)
    }

    override suspend fun refreshSession(): Result<AuthUser> {
        val refresh = tokenStorage.getRefreshToken()
            ?: return Result.Error(com.furkansogutma.app.core.common.result.AppError.Unauthorized()).also {
                _authState.value = AuthState.Guest
            }
        val result = safeApiCall {
            api.refresh(RefreshTokenRequestDto(refresh)).toDomain()
        }
        return when (result) {
            is Result.Success -> {
                tokenStorage.saveTokens(result.data.accessToken, result.data.refreshToken)
                _authState.value = AuthState.Authenticated(result.data.user)
                Result.Success(result.data.user)
            }
            is Result.Error -> {
                tokenStorage.clearTokens()
                _authState.value = AuthState.Guest
                result
            }
        }
    }

    override suspend fun me(): Result<AuthUser> {
        val result = safeApiCall { api.me().toDomain() }
        if (result is Result.Success) {
            _authState.value = AuthState.Authenticated(result.data)
        }
        return result
    }

    override suspend fun updateProfile(input: UpdateProfileInput): Result<AuthUser> {
        val result = safeApiCall {
            api.updateProfile(
                UpdateProfileRequestDto(
                    firstName = input.firstName,
                    lastName = input.lastName,
                    phone = input.phone,
                ),
            ).toDomain()
        }
        if (result is Result.Success) {
            _authState.value = AuthState.Authenticated(result.data)
        }
        return result
    }

    override suspend fun restoreSession(): Result<AuthUser?> {
        val access = tokenStorage.getAccessToken()
        if (access.isNullOrBlank()) {
            _authState.value = AuthState.Guest
            return Result.Success(null)
        }
        return when (val meResult = me()) {
            is Result.Success -> Result.Success(meResult.data)
            is Result.Error -> {
                when (val refreshed = refreshSession()) {
                    is Result.Success -> Result.Success(refreshed.data)
                    is Result.Error -> {
                        _authState.value = AuthState.Guest
                        Result.Success(null)
                    }
                }
            }
        }
    }


    override suspend fun forgotPassword(email: String): Result<String> {
        return safeApiCall {
            api.forgotPassword(ForgotPasswordRequestDto(email.trim().lowercase())).message
        }
    }
}
