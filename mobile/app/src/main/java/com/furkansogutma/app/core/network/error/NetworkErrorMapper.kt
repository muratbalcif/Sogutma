package com.furkansogutma.app.core.network.error

import com.furkansogutma.app.core.common.result.AppError
import com.squareup.moshi.Moshi
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.inject.Inject
import javax.inject.Singleton
import retrofit2.HttpException

@Singleton
class NetworkErrorMapper @Inject constructor(
    moshi: Moshi,
) {
    private val adapter = moshi.adapter(ApiErrorBody::class.java)

    fun map(throwable: Throwable): AppError = when (throwable) {
        is HttpException -> mapHttp(throwable)
        is SocketTimeoutException, is UnknownHostException, is IOException -> AppError.Network()
        else -> AppError.Unknown()
    }

    private fun mapHttp(exception: HttpException): AppError {
        val body = runCatching {
            exception.response()?.errorBody()?.string()?.let { adapter.fromJson(it) }
        }.getOrNull()
        val message = body?.message?.let { msg ->
            when (msg) {
                is String -> msg
                is List<*> -> msg.filterIsInstance<String>().joinToString(", ")
                else -> null
            }
        }
        return when (exception.code()) {
            401 -> AppError.Unauthorized(message ?: AppError.Unauthorized().message)
            403 -> AppError.Forbidden(message ?: AppError.Forbidden().message)
            404 -> AppError.NotFound(message ?: AppError.NotFound().message)
            in 400..499 -> AppError.Validation(message ?: "Geçersiz istek.")
            in 500..599 -> AppError.Server(message ?: AppError.Server().message)
            else -> AppError.Unknown(message ?: AppError.Unknown().message)
        }
    }
}

data class ApiErrorBody(
    val message: Any? = null,
    val statusCode: Int? = null,
)
