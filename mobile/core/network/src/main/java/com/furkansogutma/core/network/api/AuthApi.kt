package com.furkansogutma.core.network.api

import com.furkansogutma.core.network.dto.AuthTokensDto
import com.furkansogutma.core.network.dto.ForgotPasswordRequestDto
import com.furkansogutma.core.network.dto.LoginRequestDto
import com.furkansogutma.core.network.dto.LogoutRequestDto
import com.furkansogutma.core.network.dto.MessageResponseDto
import com.furkansogutma.core.network.dto.RefreshTokenRequestDto
import com.furkansogutma.core.network.dto.RegisterRequestDto
import com.furkansogutma.core.network.dto.UserDto
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AuthApi {
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequestDto): AuthTokensDto

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequestDto): AuthTokensDto

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshTokenRequestDto): AuthTokensDto

    @POST("auth/logout")
    suspend fun logout(@Body body: LogoutRequestDto): Map<String, Boolean>

    @GET("auth/me")
    suspend fun me(): UserDto

    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body body: ForgotPasswordRequestDto): MessageResponseDto
}
