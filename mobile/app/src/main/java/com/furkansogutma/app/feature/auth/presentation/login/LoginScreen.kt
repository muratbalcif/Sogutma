package com.furkansogutma.app.feature.auth.presentation.login

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.input.KeyboardType
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.app.R
import com.furkansogutma.app.core.designsystem.components.FurkanButton
import com.furkansogutma.app.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.app.core.designsystem.components.FurkanTextField
import com.furkansogutma.app.core.designsystem.theme.FurkanSpacing

@Composable
fun LoginRoute(
    onLoggedIn: () -> Unit,
    onRegister: () -> Unit,
    onForgotPassword: () -> Unit,
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
        onForgotPassword = onForgotPassword,
    )
}

@Composable
fun LoginScreen(
    state: LoginUiState,
    onEvent: (LoginEvent) -> Unit,
    onRegister: () -> Unit,
    onForgotPassword: () -> Unit = {},
) {
    Column(
        Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = FurkanSpacing.xl, vertical = FurkanSpacing.lg)
            .semantics { contentDescription = "Login" },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(FurkanSpacing.lg))
        Image(
            painter = painterResource(R.drawable.ic_logo),
            contentDescription = "FurkanSoğutma",
            modifier = Modifier.height(200.dp),
            contentScale = ContentScale.Fit,
        )
        Spacer(Modifier.height(FurkanSpacing.xs))
        Text(
            "Hesabınıza giriş yapın",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(FurkanSpacing.xl))
        FurkanTextField(
            value = state.email,
            onValueChange = { onEvent(LoginEvent.EmailChanged(it)) },
            label = "E-posta",
            isError = state.emailError != null,
            supportingText = state.emailError,
            keyboardType = KeyboardType.Email,
        )
        Spacer(Modifier.height(FurkanSpacing.md))
        FurkanTextField(
            value = state.password,
            onValueChange = { onEvent(LoginEvent.PasswordChanged(it)) },
            label = "Şifre",
            isPassword = true,
            passwordVisible = state.passwordVisible,
            onTogglePassword = { onEvent(LoginEvent.TogglePassword) },
            isError = state.passwordError != null,
            supportingText = state.passwordError,
        )
        TextButton(
            onClick = onForgotPassword,
            modifier = Modifier
                .align(Alignment.End)
                .padding(vertical = FurkanSpacing.xxs),
        ) {
            Text("Şifremi unuttum", style = MaterialTheme.typography.labelLarge)
        }
        if (state.errorMessage != null) {
            Text(
                state.errorMessage!!,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(Modifier.height(FurkanSpacing.sm))
        }
        FurkanButton(
            text = "Giriş yap",
            modifier = Modifier.fillMaxWidth(),
            loading = state.isLoading,
            onClick = { onEvent(LoginEvent.Submit) },
        )
        Spacer(Modifier.height(FurkanSpacing.md))
        FurkanOutlinedButton(
            text = "Hesap oluştur",
            modifier = Modifier.fillMaxWidth(),
            onClick = onRegister,
        )
    }
}
