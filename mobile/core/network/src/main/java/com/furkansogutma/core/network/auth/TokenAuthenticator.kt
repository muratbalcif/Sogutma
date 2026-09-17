package com.furkansogutma.core.network.auth

import com.furkansogutma.core.database.token.TokenStorage
import com.furkansogutma.core.network.dto.RefreshTokenRequestDto
import com.furkansogutma.core.network.dto.AuthTokensDto
import com.squareup.moshi.Moshi
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route

/**
 * Coordinates concurrent 401 responses so only one refresh request is in flight.
 */
@Singleton
class TokenAuthenticator @Inject constructor(
    private val tokenStorage: TokenStorage,
    private val moshi: Moshi,
    @Named("refreshClient") private val refreshClient: OkHttpClient,
    @Named("apiBaseUrl") private val baseUrl: String,
) : Authenticator {

    private val mutex = Mutex()
    private val refreshing = AtomicBoolean(false)

    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) >= 2) return null
        return runBlocking {
            mutex.withLock {
                val currentAccess = tokenStorage.getAccessToken()
                val requestToken = response.request.header("Authorization")?.removePrefix("Bearer ")?.trim()
                if (!currentAccess.isNullOrBlank() && currentAccess != requestToken) {
                    return@withLock response.request.newBuilder()
                        .header("Authorization", "Bearer $currentAccess")
                        .build()
                }
                val refresh = tokenStorage.getRefreshToken() ?: return@withLock null
                refreshing.set(true)
                try {
                    val tokens = refreshTokens(refresh) ?: run {
                        tokenStorage.clearTokens()
                        return@withLock null
                    }
                    tokenStorage.saveTokens(tokens.accessToken, tokens.refreshToken)
                    response.request.newBuilder()
                        .header("Authorization", "Bearer ${tokens.accessToken}")
                        .build()
                } finally {
                    refreshing.set(false)
                }
            }
        }
    }

    private fun refreshTokens(refreshToken: String): AuthTokensDto? {
        val adapter = moshi.adapter(RefreshTokenRequestDto::class.java)
        val bodyJson = adapter.toJson(RefreshTokenRequestDto(refreshToken))
        val request = Request.Builder()
            .url(baseUrl.trimEnd('/') + "/auth/refresh")
            .post(bodyJson.toRequestBody("application/json".toMediaType()))
            .build()
        refreshClient.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) return null
            val responseBody = resp.body?.string() ?: return null
            return moshi.adapter(AuthTokensDto::class.java).fromJson(responseBody)
        }
    }

    private fun responseCount(response: Response): Int {
        var result = 1
        var prior = response.priorResponse
        while (prior != null) {
            result++
            prior = prior.priorResponse
        }
        return result
    }
}
