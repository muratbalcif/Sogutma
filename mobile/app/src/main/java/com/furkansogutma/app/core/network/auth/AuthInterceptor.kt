package com.furkansogutma.app.core.network.auth

import com.furkansogutma.app.core.datastore.TokenStorage
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenStorage: TokenStorage,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        if (original.header("Authorization") != null ||
            original.url.encodedPath.contains("/auth/login") ||
            original.url.encodedPath.contains("/auth/register") ||
            original.url.encodedPath.contains("/auth/refresh")
        ) {
            return chain.proceed(original)
        }
        val token = runBlocking { tokenStorage.getAccessToken() }
        val request = if (!token.isNullOrBlank()) {
            original.newBuilder().header("Authorization", "Bearer $token").build()
        } else {
            original
        }
        return chain.proceed(request)
    }
}
