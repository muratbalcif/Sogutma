package com.furkansogutma.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.auth.AuthRepository
import com.furkansogutma.domain.auth.RegisterInput
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class RegisterUiState(
    val firstName: String = "",
    val lastName: String = "",
    val email: String = "",
    val phone: String = "",
    val password: String = "",
    val passwordAgain: String = "",
    val userType: String = "INDIVIDUAL",
    val companyName: String = "",
    val taxNumber: String = "",
    val taxOffice: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(RegisterUiState())
    val uiState = _uiState.asStateFlow()
    private val _done = MutableSharedFlow<Unit>()
    val done = _done.asSharedFlow()

    fun update(transform: (RegisterUiState) -> RegisterUiState) {
        _uiState.update(transform)
    }

    fun submit() {
        val s = _uiState.value
        if (s.password != s.passwordAgain) {
            _uiState.update { it.copy(errorMessage = "Şifreler eşleşmiyor") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (
                val result = authRepository.register(
                    RegisterInput(
                        email = s.email,
                        password = s.password,
                        firstName = s.firstName,
                        lastName = s.lastName,
                        phone = s.phone.ifBlank { null },
                        userType = s.userType,
                        companyName = s.companyName.ifBlank { null },
                        taxNumber = s.taxNumber.ifBlank { null },
                        taxOffice = s.taxOffice.ifBlank { null },
                    ),
                )
            ) {
                is Result.Success -> {
                    _uiState.update { it.copy(isLoading = false) }
                    _done.emit(Unit)
                }
                is Result.Error -> _uiState.update {
                    it.copy(isLoading = false, errorMessage = result.error.message)
                }
            }
        }
    }
}
