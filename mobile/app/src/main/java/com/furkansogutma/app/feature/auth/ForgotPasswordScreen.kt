package com.furkansogutma.app.feature.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.designsystem.components.FurkanButton
import com.furkansogutma.core.designsystem.components.FurkanTextField
import com.furkansogutma.core.designsystem.components.FurkanTopBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.domain.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch

@HiltViewModel
class ForgotPasswordViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {
    fun submit(email: String, onResult: (Result<String>) -> Unit) {
        viewModelScope.launch { onResult(authRepository.forgotPassword(email)) }
    }
}

@Composable
fun ForgotPasswordRoute(
    onBack: () -> Unit,
    viewModel: ForgotPasswordViewModel = hiltViewModel(),
) {
    var email by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize()) {
        FurkanTopBar(title = "Şifremi unuttum", onBack = onBack)
        Column(Modifier.padding(FurkanSpacing.xl)) {
            Text("E-posta adresinize sıfırlama bağlantısı gönderilir.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(FurkanSpacing.lg))
            FurkanTextField(email, { email = it }, "E-posta", keyboardType = KeyboardType.Email)
            if (error != null) Text(error!!, color = MaterialTheme.colorScheme.error)
            if (message != null) Text(message!!, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(FurkanSpacing.lg))
            FurkanButton(
                text = "Şifre Sıfırlama Linki Gönder",
                modifier = Modifier.fillMaxWidth(),
                loading = loading,
            ) {
                loading = true
                error = null
                message = null
                viewModel.submit(email) { result ->
                    loading = false
                    when (result) {
                        is Result.Success -> message = result.data
                        is Result.Error -> error = result.error.message
                    }
                }
            }
        }
    }
}
