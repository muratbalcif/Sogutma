package com.furkansogutma.domain.auth

import com.furkansogutma.core.common.result.Result
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    val authState: Flow<AuthState>
    suspend fun login(email: String, password: String): Result<AuthUser>
    suspend fun register(input: RegisterInput): Result<AuthUser>
    suspend fun logout(): Result<Unit>
    suspend fun refreshSession(): Result<AuthUser>
    suspend fun me(): Result<AuthUser>
    suspend fun updateProfile(input: UpdateProfileInput): Result<AuthUser>
    suspend fun restoreSession(): Result<AuthUser?>
    suspend fun forgotPassword(email: String): Result<String>
}

data class RegisterInput(
    val email: String,
    val password: String,
    val firstName: String,
    val lastName: String,
    val phone: String?,
    val userType: String,
    val companyName: String? = null,
    val taxNumber: String? = null,
    val taxOffice: String? = null,
    val identityNumber: String? = null,
)

data class UpdateProfileInput(
    val firstName: String,
    val lastName: String,
    val phone: String?,
)
