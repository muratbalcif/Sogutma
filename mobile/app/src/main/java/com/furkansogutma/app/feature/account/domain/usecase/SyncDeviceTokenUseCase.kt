package com.furkansogutma.app.feature.account.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import javax.inject.Inject
import com.furkansogutma.app.feature.account.domain.repository.AccountRepository

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
