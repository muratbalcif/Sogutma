package com.furkansogutma.domain.auth

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class LoginUseCase @Inject constructor(
    private val repository: AuthRepository,
) {
    suspend operator fun invoke(email: String, password: String): Result<AuthUser> {
        if (email.isBlank() || password.isBlank()) {
            return Result.Error(com.furkansogutma.core.common.result.AppError.Validation("E-posta ve şifre gerekli."))
        }
        return repository.login(email.trim(), password)
    }
}
