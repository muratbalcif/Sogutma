package com.furkansogutma.app.feature.auth.presentation.register

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.app.core.designsystem.components.FurkanButton
import com.furkansogutma.app.core.designsystem.components.FurkanFilterChip
import com.furkansogutma.app.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.app.core.designsystem.components.FurkanTextField
import com.furkansogutma.app.core.designsystem.components.FurkanTopBar
import com.furkansogutma.app.core.designsystem.theme.FurkanSpacing

@Composable
fun RegisterRoute(
    onRegistered: () -> Unit,
    onBack: () -> Unit,
    viewModel: RegisterViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.done.collect { onRegistered() } }
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar(title = "Kayıt ol", onBack = onBack)
        Column(
            Modifier
                .fillMaxSize()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = FurkanSpacing.xl, vertical = FurkanSpacing.lg),
        ) {
            Text(
                "Yeni hesap oluşturun",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
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
            FurkanTextField(
                state.passwordAgain,
                { viewModel.update { s -> s.copy(passwordAgain = it) } },
                "Şifre tekrar",
                isPassword = true,
            )
            Spacer(Modifier.height(FurkanSpacing.md))
            Text(
                "Hesap tipi",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(FurkanSpacing.xs))
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.xs),
            ) {
                FurkanFilterChip(
                    label = "Bireysel",
                    selected = state.userType == "INDIVIDUAL",
                    onClick = { viewModel.update { it.copy(userType = "INDIVIDUAL") } },
                    modifier = Modifier.weight(1f),
                )
                FurkanFilterChip(
                    label = "Kurumsal",
                    selected = state.userType == "CORPORATE",
                    onClick = { viewModel.update { it.copy(userType = "CORPORATE") } },
                    modifier = Modifier.weight(1f),
                )
            }
            if (state.userType == "CORPORATE") {
                Spacer(Modifier.height(FurkanSpacing.md))
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
                text = "Kayıt ol",
                modifier = Modifier.fillMaxWidth(),
                loading = state.isLoading,
                enabled = !state.isLoading,
                onClick = viewModel::submit,
            )
            Spacer(Modifier.height(FurkanSpacing.sm))
            FurkanOutlinedButton(
                text = "Girişe dön",
                modifier = Modifier.fillMaxWidth(),
                onClick = onBack,
            )
            Spacer(Modifier.height(FurkanSpacing.lg))
        }
    }
}
