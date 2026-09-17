package com.furkansogutma.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.core.common.result.AppError
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.database.settings.AppSettingsDataStore
import com.furkansogutma.domain.account.SyncDeviceTokenUseCase
import com.furkansogutma.domain.auth.LoginUseCase
import com.furkansogutma.domain.cart.RefreshCartBadgeUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val passwordVisible: Boolean = false,
    val isLoading: Boolean = false,
    val emailError: String? = null,
    val passwordError: String? = null,
    val errorMessage: String? = null,
)

sealed interface LoginEvent {
    data class EmailChanged(val value: String) : LoginEvent
    data class PasswordChanged(val value: String) : LoginEvent
    data object TogglePassword : LoginEvent
    data object Submit : LoginEvent
}

sealed interface LoginEffect {
    data object NavigateHome : LoginEffect
}

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val loginUseCase: LoginUseCase,
    private val refreshCartBadge: RefreshCartBadgeUseCase,
    private val syncDeviceToken: SyncDeviceTokenUseCase,
    private val settings: AppSettingsDataStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState = _uiState.asStateFlow()
    private val _effects = MutableSharedFlow<LoginEffect>()
    val effects = _effects.asSharedFlow()

    fun onEvent(event: LoginEvent) {
        when (event) {
            is LoginEvent.EmailChanged -> _uiState.update { it.copy(email = event.value, emailError = null) }
            is LoginEvent.PasswordChanged -> _uiState.update { it.copy(password = event.value, passwordError = null) }
            LoginEvent.TogglePassword -> _uiState.update { it.copy(passwordVisible = !it.passwordVisible) }
            LoginEvent.Submit -> submit()
        }
    }

    private fun submit() {
        val state = _uiState.value
        var emailError: String? = null
        var passwordError: String? = null
        if (state.email.isBlank() || !state.email.contains("@")) emailError = "Geçerli bir e-posta girin"
        if (state.password.isBlank()) passwordError = "Şifre gerekli"
        if (emailError != null || passwordError != null) {
            _uiState.update { it.copy(emailError = emailError, passwordError = passwordError) }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (val result = loginUseCase(state.email, state.password)) {
                is Result.Success -> {
                    refreshCartBadge()
                    syncDeviceToken.register(settings.fcmToken.first())
                    _uiState.update { it.copy(isLoading = false) }
                    _effects.emit(LoginEffect.NavigateHome)
                }
                is Result.Error -> {
                    val message = when (result.error) {
                        is AppError.Unauthorized -> "E-posta veya şifre hatalı."
                        else -> result.error.message
                    }
                    _uiState.update { it.copy(isLoading = false, errorMessage = message) }
                }
            }
        }
    }
}
