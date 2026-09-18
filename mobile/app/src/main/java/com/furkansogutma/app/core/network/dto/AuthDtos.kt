package com.furkansogutma.app.core.network.dto


data class LoginRequestDto(
    val email: String,
    val password: String,
)

data class RegisterRequestDto(
    val email: String,
    val password: String,
    val firstName: String,
    val lastName: String,
    val phone: String? = null,
    val userType: String,
    val companyName: String? = null,
    val taxNumber: String? = null,
    val taxOffice: String? = null,
    val identityNumber: String? = null,
)

data class RefreshTokenRequestDto(
    val refreshToken: String,
)

data class LogoutRequestDto(
    val refreshToken: String,
)

data class AuthTokensDto(
    val user: UserDto,
    val accessToken: String,
    val refreshToken: String,
)

data class UserDto(
    val id: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val phone: String? = null,
    val userType: String,
    val status: String,
    val roles: List<String> = emptyList(),
    val permissions: List<String> = emptyList(),
)

data class UpdateProfileRequestDto(
    val firstName: String? = null,
    val lastName: String? = null,
    val phone: String? = null,
)
