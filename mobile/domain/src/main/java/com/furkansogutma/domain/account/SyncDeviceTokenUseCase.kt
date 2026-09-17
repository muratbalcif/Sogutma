package com.furkansogutma.domain.account

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class SyncDeviceTokenUseCase @Inject constructor(
    private val accountRepository: AccountRepository,
) {
    suspend fun register(token: String?): Result<Unit> {
        if (token.isNullOrBlank()) return Result.Success(Unit)
        return accountRepository.registerDeviceToken(token)
    }

    suspend fun unregister(token: String?): Result<Unit> {
        if (token.isNullOrBlank()) return Result.Success(Unit)
        return accountRepository.unregisterDeviceToken(token)
    }
}
