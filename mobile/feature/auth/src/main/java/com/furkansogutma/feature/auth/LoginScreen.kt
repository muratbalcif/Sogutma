package com.furkansogutma.feature.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.core.designsystem.components.FurkanButton
import com.furkansogutma.core.designsystem.components.FurkanTextField
import com.furkansogutma.core.designsystem.theme.FurkanSpacing

@Composable
fun LoginRoute(
    onLoggedIn: () -> Unit,
    onRegister: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        viewModel.effects.collect { effect ->
            when (effect) {
                LoginEffect.NavigateHome -> onLoggedIn()
            }
        }
    }
    LoginScreen(
        state = state,
        onEvent = viewModel::onEvent,
        onRegister = onRegister,
    )
}

@Composable
fun LoginScreen(
    state: LoginUiState,
    onEvent: (LoginEvent) -> Unit,
    onRegister: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(FurkanSpacing.xl)
            .semantics { contentDescription = "Login" },
    ) {
        Text("Giriş", style = MaterialTheme.typography.headlineLarge)
        Spacer(Modifier.height(FurkanSpacing.xl))
        FurkanTextField(
            value = state.email,
            onValueChange = { onEvent(LoginEvent.EmailChanged(it)) },
            label = "E-posta",
            isError = state.emailError != null,
            supportingText = state.emailError,
        )
        Spacer(Modifier.height(FurkanSpacing.md))
        FurkanTextField(
            value = state.password,
            onValueChange = { onEvent(LoginEvent.PasswordChanged(it)) },
            label = "Şifre",
            isPassword = true,
            isError = state.passwordError != null,
            supportingText = state.passwordError,
        )
        if (state.errorMessage != null) {
            Spacer(Modifier.height(FurkanSpacing.sm))
            Text(state.errorMessage, color = MaterialTheme.colorScheme.error)
        }
        Spacer(Modifier.height(FurkanSpacing.xl))
        FurkanButton(
            text = if (state.isLoading) "Giriş yapılıyor..." else "Giriş yap",
            onClick = { onEvent(LoginEvent.Submit) },
            enabled = !state.isLoading,
        )
        TextButton(onClick = onRegister) { Text("Hesap oluştur") }
    }
}
