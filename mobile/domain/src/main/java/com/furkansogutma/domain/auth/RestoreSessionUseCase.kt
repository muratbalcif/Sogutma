package com.furkansogutma.domain.auth

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class RestoreSessionUseCase @Inject constructor(
    private val repository: AuthRepository,
) {
    suspend operator fun invoke(): Result<AuthUser?> = repository.restoreSession()
}
