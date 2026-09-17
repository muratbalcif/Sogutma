package com.furkansogutma.feature.account

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.furkansogutma.core.designsystem.components.FurkanButton
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.domain.auth.LogoutUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch

@HiltViewModel
class AccountViewModel @Inject constructor(
    val logoutUseCase: LogoutUseCase,
) : ViewModel()

@Composable
fun AccountRoute(
    onOrders: () -> Unit,
    onFavorites: () -> Unit,
    onAddresses: () -> Unit,
    onAlerts: () -> Unit,
    onComments: () -> Unit,
    onCurrentAccount: () -> Unit,
    onBankTransfers: () -> Unit,
    onSettings: () -> Unit,
    onLoggedOut: () -> Unit,
    viewModel: AccountViewModel = hiltViewModel(),
) {
    val scope = rememberCoroutineScope()
    val items = listOf(
        "Siparişlerim" to onOrders,
        "Favorilerim" to onFavorites,
        "Adreslerim" to onAddresses,
        "Stok Bildirimlerim" to onAlerts,
        "Yorumlarım" to onComments,
        "Cari Hesabım" to onCurrentAccount,
        "Havale Bildirimlerim" to onBankTransfers,
        "Ayarlar" to onSettings,
    )
    Column(Modifier.fillMaxSize().padding(FurkanSpacing.md)) {
        Text("Hesabım", style = MaterialTheme.typography.headlineLarge)
        LazyColumn(Modifier.weight(1f)) {
            items(items) { (label, action) ->
                Text(
                    label,
                    modifier = Modifier
                        .clickable(onClick = action)
                        .padding(vertical = FurkanSpacing.md),
                    style = MaterialTheme.typography.titleMedium,
                )
            }
        }
        FurkanButton("Çıkış yap") {
            scope.launch {
                viewModel.logoutUseCase()
                onLoggedOut()
            }
        }
    }
}
