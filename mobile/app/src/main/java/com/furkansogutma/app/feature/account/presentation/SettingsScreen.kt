package com.furkansogutma.app.feature.account.presentation

import com.furkansogutma.app.feature.banktransfer.presentation.BankTransferClaimUiState
import com.furkansogutma.app.feature.banktransfer.presentation.bankTransferClaimUiState
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.math.BigDecimal
import java.math.RoundingMode
import java.text.NumberFormat
import java.util.Locale
import java.util.Currency as JavaCurrency
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.core.datastore.AppSettingsDataStore
import com.furkansogutma.app.core.designsystem.components.FurkanButton
import com.furkansogutma.app.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.app.core.designsystem.components.FurkanError
import com.furkansogutma.app.core.designsystem.components.FurkanLoading
import com.furkansogutma.app.core.designsystem.components.FurkanMenuRow
import com.furkansogutma.app.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.app.core.designsystem.components.FurkanTextField
import com.furkansogutma.app.core.designsystem.components.FurkanTopBar
import com.furkansogutma.app.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.app.core.designsystem.theme.OnSurfaceFaint
import com.furkansogutma.app.feature.account.domain.repository.AccountRepository
import com.furkansogutma.app.feature.account.domain.model.AccountTransaction
import com.furkansogutma.app.feature.account.domain.model.Address
import com.furkansogutma.app.feature.account.domain.model.AddressInput
import com.furkansogutma.app.feature.account.domain.model.BankTransfer
import com.furkansogutma.app.feature.account.domain.model.CurrentAccount
import com.furkansogutma.app.feature.account.domain.model.LegalPage
import com.furkansogutma.app.feature.account.domain.model.ProductAlert
import com.furkansogutma.app.feature.account.domain.usecase.SyncDeviceTokenUseCase
import com.furkansogutma.app.feature.auth.domain.repository.AuthRepository
import com.furkansogutma.app.feature.auth.domain.model.AuthState
import com.furkansogutma.app.feature.auth.domain.model.AuthUser
import com.furkansogutma.app.feature.auth.domain.usecase.LogoutUseCase
import com.furkansogutma.app.feature.auth.domain.repository.UpdateProfileInput
import com.furkansogutma.app.feature.cart.domain.usecase.CartBadgeStore
import com.furkansogutma.app.feature.favorite.domain.repository.FavoriteRepository
import com.furkansogutma.app.feature.notification.domain.model.NotificationPreferences
import com.furkansogutma.app.feature.notification.domain.repository.NotificationRepository
import com.furkansogutma.app.feature.order.domain.usecase.GetOrderUseCase
import com.furkansogutma.app.feature.order.domain.usecase.GetOrdersUseCase
import com.furkansogutma.app.feature.order.domain.model.Order
import com.furkansogutma.app.feature.order.domain.repository.OrderRepository
import com.furkansogutma.app.feature.product.domain.model.Product
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@Composable
fun SettingsRoute(
    onBack: () -> Unit = {},
    onLegal: (String) -> Unit = {},
    vm: AccountDataViewModel = hiltViewModel(),
) {
    val theme by vm.settings.themeMode.collectAsStateWithLifecycle(initialValue = "system")
    var prefs by remember { mutableStateOf<NotificationPreferences?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) {
        when (val result = vm.notificationRepository.getPreferences()) {
            is Result.Success -> prefs = result.data
            is Result.Error -> Unit
        }
    }
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Ayarlar", onBack = onBack)
        Column(Modifier.padding(FurkanSpacing.md)) {
            Text("Tema", style = MaterialTheme.typography.titleLarge)
            listOf("system" to "Sistem", "light" to "Açık", "dark" to "Koyu").forEach { (value, label) ->
                Text(
                    if (theme == value) "✓ $label" else label,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { scope.launch { vm.settings.setThemeMode(value) } }
                        .padding(vertical = FurkanSpacing.sm),
                )
            }
            Spacer(Modifier.height(FurkanSpacing.lg))
            Text("Bildirim tercihleri", style = MaterialTheme.typography.titleLarge)
            val current = prefs
            if (current == null) {
                Text("Yükleniyor…", color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                preferenceToggle("Sipariş bildirimleri", current.orderNotifications) {
                    val updated = current.copy(orderNotifications = it)
                    prefs = updated
                    scope.launch { vm.notificationRepository.updatePreferences(updated) }
                }
                preferenceToggle("Ödeme bildirimleri", current.paymentNotifications) {
                    val updated = current.copy(paymentNotifications = it)
                    prefs = updated
                    scope.launch { vm.notificationRepository.updatePreferences(updated) }
                }
                preferenceToggle("Stok uyarıları", current.stockAlerts) {
                    val updated = current.copy(stockAlerts = it)
                    prefs = updated
                    scope.launch { vm.notificationRepository.updatePreferences(updated) }
                }
                preferenceToggle("Kampanya bildirimleri", current.campaignNotifications) {
                    val updated = current.copy(campaignNotifications = it)
                    prefs = updated
                    scope.launch { vm.notificationRepository.updatePreferences(updated) }
                }
                preferenceToggle("Sistem bildirimleri", current.systemNotifications) {
                    val updated = current.copy(systemNotifications = it)
                    prefs = updated
                    scope.launch { vm.notificationRepository.updatePreferences(updated) }
                }
            }
            Spacer(Modifier.height(FurkanSpacing.lg))
            Text("Yasal", style = MaterialTheme.typography.titleLarge)
            listOf(
                "kvkk" to "KVKK Aydınlatma",
                "privacy" to "Gizlilik Politikası",
                "terms" to "Kullanım Koşulları",
            ).forEach { (slug, label) ->
                Text(
                    label,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onLegal(slug) }
                        .padding(vertical = FurkanSpacing.sm),
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

@Composable
fun preferenceToggle(label: String, enabled: Boolean, onToggle: (Boolean) -> Unit) {
    Text(
        if (enabled) "✓ $label" else label,
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onToggle(!enabled) }
            .padding(vertical = FurkanSpacing.sm),
    )
}
