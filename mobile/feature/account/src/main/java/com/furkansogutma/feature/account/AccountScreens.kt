package com.furkansogutma.feature.account

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.database.settings.AppSettingsDataStore
import com.furkansogutma.core.designsystem.components.FurkanButton
import com.furkansogutma.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.core.designsystem.components.FurkanTextField
import com.furkansogutma.core.designsystem.components.FurkanTopBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.account.AccountTransaction
import com.furkansogutma.domain.account.Address
import com.furkansogutma.domain.account.AddressInput
import com.furkansogutma.domain.account.BankTransfer
import com.furkansogutma.domain.account.CurrentAccount
import com.furkansogutma.domain.account.ProductAlert
import com.furkansogutma.domain.auth.AuthRepository
import com.furkansogutma.domain.auth.AuthState
import com.furkansogutma.domain.auth.AuthUser
import com.furkansogutma.domain.auth.LogoutUseCase
import com.furkansogutma.domain.cart.CartBadgeStore
import com.furkansogutma.domain.favorite.FavoriteRepository
import com.furkansogutma.domain.order.GetOrderUseCase
import com.furkansogutma.domain.order.GetOrdersUseCase
import com.furkansogutma.domain.order.Order
import com.furkansogutma.domain.product.Product
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@HiltViewModel
class AccountViewModel @Inject constructor(
    authRepository: AuthRepository,
    private val logoutUseCase: LogoutUseCase,
    private val badgeStore: CartBadgeStore,
) : ViewModel() {
    val authState = authRepository.authState.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        AuthState.Loading,
    )

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            logoutUseCase()
            badgeStore.clear()
            onDone()
        }
    }
}

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
    onProfile: () -> Unit,
    onLoggedOut: () -> Unit,
    viewModel: AccountViewModel = hiltViewModel(),
) {
    val auth by viewModel.authState.collectAsStateWithLifecycle()
    val user = (auth as? AuthState.Authenticated)?.user
    val items = listOf(
        "Profilim" to onProfile,
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
        Spacer(Modifier.height(FurkanSpacing.md))
        if (user != null) {
            Text("${user.firstName} ${user.lastName}", style = MaterialTheme.typography.titleLarge)
            Text(user.email, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (user.userType == "CORPORATE") {
                Text("Kurumsal müşteri", color = MaterialTheme.colorScheme.primary)
            }
        }
        Spacer(Modifier.height(FurkanSpacing.lg))
        LazyColumn(Modifier.weight(1f)) {
            items(items) { (label, action) ->
                Text(
                    label,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = action)
                        .padding(vertical = FurkanSpacing.md),
                    style = MaterialTheme.typography.titleMedium,
                )
            }
        }
        FurkanButton("Çıkış yap") { viewModel.logout(onLoggedOut) }
    }
}

@HiltViewModel
class AccountDataViewModel @Inject constructor(
    val accountRepository: AccountRepository,
    val favoriteRepository: FavoriteRepository,
    val getOrders: GetOrdersUseCase,
    val getOrder: GetOrderUseCase,
    val settings: AppSettingsDataStore,
    val authRepository: AuthRepository,
) : ViewModel()

@Composable
fun ProfileRoute(onBack: () -> Unit, vm: AccountDataViewModel = hiltViewModel()) {
    var user by remember { mutableStateOf<AuthUser?>(null) }
    LaunchedEffect(Unit) {
        when (val result = vm.authRepository.me()) {
            is Result.Success -> user = result.data
            is Result.Error -> Unit
        }
    }
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Profil", onBack = onBack)
        Column(Modifier.padding(FurkanSpacing.md)) {
            if (user == null) FurkanLoading(Modifier.height(FurkanSpacing.xxl))
            else {
                FurkanTextField(user!!.firstName, {}, "Ad", enabled = false)
                FurkanTextField(user!!.lastName, {}, "Soyad", enabled = false)
                FurkanTextField(user!!.email, {}, "E-posta", enabled = false)
                FurkanTextField(user!!.phone.orEmpty(), {}, "Telefon", enabled = false)
                Text(
                    "Profil güncelleme API'si henüz yok. Bilgiler salt okunur gösterilir.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
fun OrdersRoute(onOrderClick: (String) -> Unit, onBack: () -> Unit = {}, vm: AccountDataViewModel = hiltViewModel()) {
    var orders by remember { mutableStateOf<List<Order>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        when (val result = vm.getOrders()) {
            is Result.Success -> orders = result.data
            is Result.Error -> error = result.error.message
        }
    }
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Siparişlerim", onBack = onBack)
        when {
            error != null -> FurkanError(error!!)
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
                        Text("${order.createdAt} · ${order.status}")
                        Text("${order.total} ${order.currency}")
                        order.paymentStatus?.let { Text("Ödeme: $it") }
                    }
                }
            }
        }
    }
}

@Composable
fun OrderDetailRoute(orderId: String, onBack: () -> Unit = {}, vm: AccountDataViewModel = hiltViewModel()) {
    var order by remember { mutableStateOf<Order?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(orderId) {
        when (val result = vm.getOrder(orderId)) {
            is Result.Success -> order = result.data
            is Result.Error -> error = result.error.message
        }
    }
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Sipariş detayı", onBack = onBack)
        when {
            error != null -> FurkanError(error!!)
            order == null -> FurkanLoading()
            else -> Column(Modifier.padding(FurkanSpacing.md)) {
                Text(order!!.orderNumber, style = MaterialTheme.typography.headlineLarge)
                Text(order!!.status)
                order!!.paymentStatus?.let { Text("Ödeme: $it") }
                order!!.shippingSummary?.let { Text(it) }
                Spacer(Modifier.height(FurkanSpacing.md))
                order!!.items.forEach {
                    Text("${it.name} x${it.quantity}")
                    Text("${it.unitPrice} → ${it.total}")
                }
                Spacer(Modifier.height(FurkanSpacing.md))
                Text("Sipariş geçmişi", style = MaterialTheme.typography.titleLarge)
                order!!.statusHistory.forEach {
                    Text("${it.createdAt}: ${it.status}")
                }
            }
        }
    }
}

@Composable
fun FavoritesRoute(
    onProductClick: (String) -> Unit,
    onBack: () -> Unit = {},
    vm: AccountDataViewModel = hiltViewModel(),
) {
    var products by remember { mutableStateOf<List<Product>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) {
        when (val result = vm.favoriteRepository.getFavorites()) {
            is Result.Success -> products = result.data
            is Result.Error -> error = result.error.message
        }
    }
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Favorilerim", onBack = onBack)
        when {
            error != null -> FurkanError(error!!)
            products == null -> FurkanLoading()
            products!!.isEmpty() -> FurkanEmptyState("Favori yok", "Favori ürünleriniz burada görünür.")
            else -> LazyColumn(Modifier.padding(FurkanSpacing.md)) {
                items(products!!, key = { it.id }) { p ->
                    Column(Modifier.padding(vertical = FurkanSpacing.sm)) {
                        Text(p.name, Modifier.clickable { onProductClick(p.slug) }, style = MaterialTheme.typography.titleMedium)
                        FurkanOutlinedButton("Favoriden çıkar") {
                            scope.launch {
                                vm.favoriteRepository.removeFavorite(p.id)
                                products = products?.filterNot { it.id == p.id }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AddressesRoute(onBack: () -> Unit = {}, onCreate: () -> Unit = {}, vm: AccountDataViewModel = hiltViewModel()) {
    var addresses by remember { mutableStateOf<List<Address>?>(null) }
    LaunchedEffect(Unit) {
        when (val result = vm.accountRepository.getAddresses()) {
            is Result.Success -> addresses = result.data
            is Result.Error -> addresses = emptyList()
        }
    }
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Adreslerim", onBack = onBack)
        when {
            addresses == null -> FurkanLoading()
            addresses!!.isEmpty() -> FurkanEmptyState("Adres yok", "Teslimat adresi ekleyin.", "Yeni adres", onCreate)
            else -> {
                LazyColumn(Modifier.weight(1f).padding(FurkanSpacing.md)) {
                    items(addresses!!, key = { it.id }) {
                        Text("${it.title} — ${it.fullName}")
                        Text("${it.addressLine}, ${it.district}/${it.city}")
                        if (it.isDefault) Text("Varsayılan", color = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.height(FurkanSpacing.md))
                    }
                }
                FurkanButton("+ Yeni Adres", Modifier.fillMaxWidth().padding(FurkanSpacing.md), onClick = onCreate)
            }
        }
    }
}

@Composable
fun AddressFormRoute(onBack: () -> Unit, onSaved: () -> Unit, vm: AccountDataViewModel = hiltViewModel()) {
    var title by remember { mutableStateOf("Ev") }
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var district by remember { mutableStateOf("") }
    var addressLine by remember { mutableStateOf("") }
    var postal by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Yeni adres", onBack = onBack)
        Column(Modifier.padding(FurkanSpacing.md)) {
            FurkanTextField(title, { title = it }, "Adres başlığı")
            FurkanTextField(firstName, { firstName = it }, "Ad")
            FurkanTextField(lastName, { lastName = it }, "Soyad")
            FurkanTextField(phone, { phone = it }, "Telefon")
            FurkanTextField(city, { city = it }, "İl")
            FurkanTextField(district, { district = it }, "İlçe")
            FurkanTextField(addressLine, { addressLine = it }, "Adres")
            FurkanTextField(postal, { postal = it }, "Posta kodu")
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            FurkanButton("Kaydet", Modifier.fillMaxWidth()) {
                scope.launch {
                    when (
                        val result = vm.accountRepository.createAddress(
                            AddressInput(title, firstName, lastName, phone, city, district, null, addressLine, postal.ifBlank { null }),
                        )
                    ) {
                        is Result.Success -> onSaved()
                        is Result.Error -> error = result.error.message
                    }
                }
            }
        }
    }
}

@Composable
fun AlertsRoute(onBack: () -> Unit = {}, vm: AccountDataViewModel = hiltViewModel()) {
    var alerts by remember { mutableStateOf<List<ProductAlert>?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) {
        when (val result = vm.accountRepository.getAlerts()) {
            is Result.Success -> alerts = result.data
            is Result.Error -> alerts = emptyList()
        }
    }
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Stok bildirimleri", onBack = onBack)
        when {
            alerts == null -> FurkanLoading()
            alerts!!.isEmpty() -> FurkanEmptyState("Bildirim yok", "Stok bildirimleriniz burada.")
            else -> LazyColumn(Modifier.padding(FurkanSpacing.md)) {
                items(alerts!!, key = { it.id }) { alert ->
                    Text("${alert.productName ?: alert.productId} — ${alert.status.orEmpty()}")
                    FurkanOutlinedButton("İptal") {
                        scope.launch {
                            vm.accountRepository.deleteAlert(alert.productId)
                            alerts = alerts?.filterNot { it.id == alert.id }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CommentsRoute(onBack: () -> Unit = {}) {
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Yorumlarım", onBack = onBack)
        FurkanEmptyState("Yorum yok", "Henüz yorumunuz bulunmuyor. (Comment API backend'de yok)")
    }
}

@Composable
fun CurrentAccountRoute(onBack: () -> Unit = {}, vm: AccountDataViewModel = hiltViewModel()) {
    var current by remember { mutableStateOf<CurrentAccount?>(null) }
    var txs by remember { mutableStateOf<List<AccountTransaction>>(emptyList()) }
    LaunchedEffect(Unit) {
        when (val result = vm.accountRepository.getCurrentAccount()) {
            is Result.Success -> current = result.data
            is Result.Error -> Unit
        }
        when (val result = vm.accountRepository.getTransactions()) {
            is Result.Success -> txs = result.data
            is Result.Error -> Unit
        }
    }
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Cari hesabım", onBack = onBack)
        Column(Modifier.padding(FurkanSpacing.md)) {
            current?.let {
                Text("Güncel bakiye: ${it.balance} ${it.currency}", style = MaterialTheme.typography.headlineLarge)
                Text("Borç: ${it.debit.orEmpty()}")
                Text("Alacak: ${it.credit.orEmpty()}")
            } ?: FurkanLoading(Modifier.height(FurkanSpacing.xxl))
            Spacer(Modifier.height(FurkanSpacing.lg))
            txs.forEach {
                Text("${it.createdAt}")
                Text("${it.description.orEmpty()} · ${it.type} ${it.amount}")
                Spacer(Modifier.height(FurkanSpacing.sm))
            }
        }
    }
}

@Composable
fun BankTransfersRoute(orderId: String? = null, onBack: () -> Unit = {}, vm: AccountDataViewModel = hiltViewModel()) {
    var items by remember { mutableStateOf<List<BankTransfer>?>(null) }
    var sender by remember { mutableStateOf("") }
    var date by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) {
        when (val result = vm.accountRepository.getBankTransfers()) {
            is Result.Success -> items = result.data
            is Result.Error -> items = emptyList()
        }
    }
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Havale bildirimleri", onBack = onBack)
        Column(Modifier.padding(FurkanSpacing.md)) {
            if (orderId != null) {
                Text("Yeni bildirim", style = MaterialTheme.typography.titleLarge)
                FurkanTextField(sender, { sender = it }, "Gönderen ad")
                FurkanTextField(date, { date = it }, "Tarih (YYYY-MM-DD)")
                FurkanTextField(note, { note = it }, "Açıklama")
                FurkanButton("Bildirim gönder", Modifier.fillMaxWidth()) {
                    scope.launch {
                        when (
                            val result = vm.accountRepository.createBankTransfer(
                                orderId = orderId,
                                amount = "",
                                description = sender.ifBlank { note },
                                bankName = null,
                                transferDate = date,
                            )
                        ) {
                            is Result.Success -> {
                                message = "Bildirim gönderildi."
                                items = listOf(result.data) + (items.orEmpty())
                            }
                            is Result.Error -> message = result.error.message
                        }
                    }
                }
                message?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
                Spacer(Modifier.height(FurkanSpacing.lg))
            }
            when {
                items == null -> FurkanLoading()
                items!!.isEmpty() -> FurkanEmptyState("Havale yok", "Havale bildirimleriniz burada.")
                else -> items!!.forEach {
                    Text("${it.amount} — ${it.status}")
                    Text(it.description.orEmpty())
                    Spacer(Modifier.height(FurkanSpacing.sm))
                }
            }
        }
    }
}

@Composable
fun SettingsRoute(onBack: () -> Unit = {}, vm: AccountDataViewModel = hiltViewModel()) {
    val theme by vm.settings.themeMode.collectAsStateWithLifecycle(initialValue = "system")
    val scope = rememberCoroutineScope()
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
            Text("Bildirim tercihleri backend preference API'si ile senkronize edilebilir.")
        }
    }
}
