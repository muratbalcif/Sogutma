package com.furkansogutma.feature.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.core.designsystem.components.FurkanButton
import com.furkansogutma.core.designsystem.components.FurkanTextField
import com.furkansogutma.core.designsystem.theme.FurkanSpacing

@Composable
fun RegisterRoute(
    onRegistered: () -> Unit,
    onBack: () -> Unit,
    viewModel: RegisterViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.done.collect { onRegistered() } }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(FurkanSpacing.xl),
    ) {
        Text("Kayıt ol", style = MaterialTheme.typography.headlineLarge)
        Spacer(Modifier.height(FurkanSpacing.lg))
        FurkanTextField(state.firstName, { viewModel.update { s -> s.copy(firstName = it) } }, "Ad")
        Spacer(Modifier.height(FurkanSpacing.sm))
        FurkanTextField(state.lastName, { viewModel.update { s -> s.copy(lastName = it) } }, "Soyad")
        Spacer(Modifier.height(FurkanSpacing.sm))
        FurkanTextField(state.email, { viewModel.update { s -> s.copy(email = it) } }, "E-posta")
        Spacer(Modifier.height(FurkanSpacing.sm))
        FurkanTextField(state.phone, { viewModel.update { s -> s.copy(phone = it) } }, "Telefon")
        Spacer(Modifier.height(FurkanSpacing.sm))
        FurkanTextField(state.password, { viewModel.update { s -> s.copy(password = it) } }, "Şifre", isPassword = true)
        Spacer(Modifier.height(FurkanSpacing.sm))
        FurkanTextField(state.passwordAgain, { viewModel.update { s -> s.copy(passwordAgain = it) } }, "Şifre tekrar", isPassword = true)
        Spacer(Modifier.height(FurkanSpacing.sm))
        FurkanButton(
            text = if (state.userType == "INDIVIDUAL") "Tip: Bireysel" else "Tip: Kurumsal",
            onClick = {
                viewModel.update {
                    it.copy(userType = if (it.userType == "INDIVIDUAL") "CORPORATE" else "INDIVIDUAL")
                }
            },
        )
        if (state.userType == "CORPORATE") {
            Spacer(Modifier.height(FurkanSpacing.sm))
            FurkanTextField(state.companyName, { viewModel.update { s -> s.copy(companyName = it) } }, "Firma adı")
            Spacer(Modifier.height(FurkanSpacing.sm))
            FurkanTextField(state.taxNumber, { viewModel.update { s -> s.copy(taxNumber = it) } }, "Vergi numarası")
            Spacer(Modifier.height(FurkanSpacing.sm))
            FurkanTextField(state.taxOffice, { viewModel.update { s -> s.copy(taxOffice = it) } }, "Vergi dairesi")
        }
        if (state.errorMessage != null) {
            Spacer(Modifier.height(FurkanSpacing.sm))
            Text(state.errorMessage!!, color = MaterialTheme.colorScheme.error)
        }
        Spacer(Modifier.height(FurkanSpacing.lg))
        FurkanButton(
            text = if (state.isLoading) "Kaydediliyor..." else "Kayıt ol",
            enabled = !state.isLoading,
            onClick = viewModel::submit,
        )
        Spacer(Modifier.height(FurkanSpacing.sm))
        FurkanButton(text = "Geri", onClick = onBack)
    }
}
