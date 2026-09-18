package com.furkansogutma.app.feature.auth.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import javax.inject.Inject
import com.furkansogutma.app.feature.auth.domain.model.AuthUser
import com.furkansogutma.app.feature.auth.domain.repository.AuthRepository

class LoginUseCase @Inject constructor(
    private val repository: AuthRepository,
) {
    suspend operator fun invoke(email: String, password: String): Result<AuthUser> {
        if (email.isBlank() || password.isBlank()) {
            return Result.Error(com.furkansogutma.app.core.common.result.AppError.Validation("E-posta ve şifre gerekli."))
        }
        return repository.login(email.trim(), password)
    }
}
