package com.furkansogutma.app.core.network

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.core.network.error.NetworkErrorMapper
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SafeApiCall @Inject constructor(
    private val errorMapper: NetworkErrorMapper,
) {
    suspend operator fun <T> invoke(block: suspend () -> T): Result<T> = try {
        Result.Success(block())
    } catch (t: Throwable) {
        Result.Error(errorMapper.map(t))
    }
}
