package com.furkansogutma.app.feature.auth.domain.model

data class AuthUser(
    val id: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val phone: String?,
    val userType: String,
    val status: String,
)

data class AuthSession(
    val user: AuthUser,
    val accessToken: String,
    val refreshToken: String,
)

sealed class AuthState {
    data object Loading : AuthState()
    data object Guest : AuthState()
    data class Authenticated(val user: AuthUser) : AuthState()
}
