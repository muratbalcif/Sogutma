package com.furkansogutma.app.feature.order.presentation

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
fun OrdersRoute(onOrderClick: (String) -> Unit, onBack: () -> Unit = {}, vm: OrdersViewModel = hiltViewModel()) {
    var orders by remember { mutableStateOf<List<Order>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun load() {
        scope.launch {
            orders = null
            error = null
            when (val result = vm.getOrders()) {
                is Result.Success -> orders = result.data
                is Result.Error -> error = result.error.message
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Siparişlerim", onBack = onBack)
        when {
            error != null && orders == null -> FurkanError(error!!) { load() }
            orders == null -> FurkanLoading()
            orders!!.isEmpty() -> FurkanEmptyState("Sipariş yok", "Henüz siparişiniz bulunmuyor.")
            else -> LazyColumn(Modifier.padding(FurkanSpacing.md)) {
                items(orders!!, key = { it.id }) { order ->
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clickable { onOrderClick(order.id) }
                            .padding(vertical = FurkanSpacing.sm),
                    ) {
                        Text(order.orderNumber, style = MaterialTheme.typography.titleMedium)
                        Text("${order.createdAt} · ${com.furkansogutma.app.core.common.labels.EnumLabels.orderStatus(order.status)}")
                        Text("${order.total} ${order.currency}")
                        order.paymentStatus?.let {
                            Text("Ödeme: ${com.furkansogutma.app.core.common.labels.EnumLabels.paymentStatus(it)}")
                        }
                    }
                }
            }
        }
    }
}
