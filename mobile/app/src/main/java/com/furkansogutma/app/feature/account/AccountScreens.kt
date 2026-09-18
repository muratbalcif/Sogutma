package com.furkansogutma.app.feature.account

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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
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
import com.furkansogutma.core.designsystem.components.FurkanMenuRow
import com.furkansogutma.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.core.designsystem.components.FurkanTextField
import com.furkansogutma.core.designsystem.components.FurkanTopBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.core.designsystem.theme.OnSurfaceFaint
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.account.AccountTransaction
import com.furkansogutma.domain.account.Address
import com.furkansogutma.domain.account.AddressInput
import com.furkansogutma.domain.account.BankTransfer
import com.furkansogutma.domain.account.CurrentAccount
import com.furkansogutma.domain.account.LegalPage
import com.furkansogutma.domain.account.ProductAlert
import com.furkansogutma.domain.account.SyncDeviceTokenUseCase
import com.furkansogutma.domain.auth.AuthRepository
import com.furkansogutma.domain.auth.AuthState
import com.furkansogutma.domain.auth.AuthUser
import com.furkansogutma.domain.auth.LogoutUseCase
import com.furkansogutma.domain.auth.UpdateProfileInput
import com.furkansogutma.domain.cart.CartBadgeStore
import com.furkansogutma.domain.favorite.FavoriteRepository
import com.furkansogutma.domain.notification.NotificationPreferences
import com.furkansogutma.domain.notification.NotificationRepository
import com.furkansogutma.domain.order.GetOrderUseCase
import com.furkansogutma.domain.order.GetOrdersUseCase
import com.furkansogutma.domain.order.Order
import com.furkansogutma.domain.order.OrderRepository
import com.furkansogutma.domain.product.Product
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@HiltViewModel
class AccountViewModel @Inject constructor(
    authRepository: AuthRepository,
    private val logoutUseCase: LogoutUseCase,
    private val badgeStore: CartBadgeStore,
    private val syncDeviceToken: SyncDeviceTokenUseCase,
    private val settings: AppSettingsDataStore,
    private val notificationRepository: NotificationRepository,
) : ViewModel() {
    val authState = authRepository.authState.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        AuthState.Loading,
    )

    var unreadNotifications by mutableStateOf(0)
        private set

    init {
        viewModelScope.launch {
            when (val result = notificationRepository.getUnreadCount()) {
                is Result.Success -> unreadNotifications = result.data.count
                is Result.Error -> Unit
            }
        }
    }

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            val token = settings.fcmToken.first()
            syncDeviceToken.unregister(token)
            logoutUseCase()
            badgeStore.clear()
            onDone()
        }
    }
}

@Composable
fun AccountRoute(
    onOrders: () -> Unit,
    onNotifications: () -> Unit,
    onFavorites: () -> Unit,
    onAddresses: () -> Unit,
    onAlerts: () -> Unit,
    onCurrentAccount: () -> Unit,
    onBankTransfers: () -> Unit,
    onSettings: () -> Unit,
    onProfile: () -> Unit,
    onLoggedOut: () -> Unit,
    viewModel: AccountViewModel = hiltViewModel(),
) {
    val auth by viewModel.authState.collectAsStateWithLifecycle()
    val user = (auth as? AuthState.Authenticated)?.user
    val unread = viewModel.unreadNotifications
    data class MenuItem(val label: String, val icon: ImageVector, val action: () -> Unit)
    val items = listOf(
        MenuItem("Profilim", Icons.Default.Person, onProfile),
        MenuItem("Siparişlerim", Icons.Default.ShoppingBag, onOrders),
        MenuItem(if (unread > 0) "Bildirimler ($unread)" else "Bildirimler", Icons.Default.Notifications, onNotifications),
        MenuItem("Favori Ürünlerim", Icons.Default.Favorite, onFavorites),
        MenuItem("Adreslerim", Icons.Default.LocationOn, onAddresses),
        MenuItem("Havale Bildirimleri", Icons.Outlined.AccountBalance, onBankTransfers),
        MenuItem("Cari İşlemler", Icons.Outlined.AccountBalanceWallet, onCurrentAccount),
        MenuItem("Alarm Listesi", Icons.Outlined.NotificationsActive, onAlerts),
        MenuItem("Ayarlar", Icons.Default.Settings, onSettings),
    )
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar(title = "Hesabım")
        LazyColumn(
            Modifier
                .weight(1f)
                .padding(horizontal = FurkanSpacing.md),
            verticalArrangement = Arrangement.spacedBy(FurkanSpacing.xs),
        ) {
            item {
                Spacer(Modifier.height(FurkanSpacing.sm))
                if (user != null) {
                    Text(
                        "${user.firstName} ${user.lastName}",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(user.email, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (user.userType == "CORPORATE") {
                        Text("Kurumsal müşteri", color = MaterialTheme.colorScheme.primary)
                    }
                    Spacer(Modifier.height(FurkanSpacing.md))
                }
            }
            items(items) { item ->
                FurkanMenuRow(title = item.label, icon = item.icon, onClick = item.action)
            }
            item {
                Spacer(Modifier.height(FurkanSpacing.sm))
                FurkanMenuRow(
                    title = "Çıkış Yap",
                    icon = Icons.AutoMirrored.Filled.Logout,
                    onClick = { viewModel.logout(onLoggedOut) },
                )
                Text(
                    "v0.1.0",
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = FurkanSpacing.md),
                    color = OnSurfaceFaint,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}

@HiltViewModel
class AccountDataViewModel @Inject constructor(
    val accountRepository: AccountRepository,
    val favoriteRepository: FavoriteRepository,
    val getOrders: GetOrdersUseCase,
    val getOrder: GetOrderUseCase,
    private val orderRepository: OrderRepository,
    val notificationRepository: NotificationRepository,
    val settings: AppSettingsDataStore,
    val authRepository: AuthRepository,
) : ViewModel() {
    suspend fun cancelOrder(id: String) = orderRepository.cancelOrder(id)
}
@Composable
fun ProfileRoute(onBack: () -> Unit, vm: AccountDataViewModel = hiltViewModel()) {
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var loaded by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        when (val result = vm.authRepository.me()) {
            is Result.Success -> {
                firstName = result.data.firstName
                lastName = result.data.lastName
                email = result.data.email
                phone = result.data.phone.orEmpty()
                loaded = true
            }
            is Result.Error -> {
                error = result.error.message
                loaded = true
            }
        }
    }
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Profil", onBack = onBack)
        Column(Modifier.padding(FurkanSpacing.md)) {
            when {
                !loaded -> FurkanLoading(Modifier.height(FurkanSpacing.xxl))
                error != null && firstName.isEmpty() && lastName.isEmpty() -> FurkanError(error!!)
                else -> {
                    FurkanTextField(firstName, { firstName = it }, "Ad")
                    FurkanTextField(lastName, { lastName = it }, "Soyad")
                    FurkanTextField(email, {}, "E-posta", enabled = false)
                    FurkanTextField(phone, { phone = it }, "Telefon")
                    Spacer(Modifier.height(FurkanSpacing.md))
                    FurkanButton(
                        "Kaydet",
                        Modifier.fillMaxWidth(),
                        enabled = firstName.isNotBlank() && lastName.isNotBlank(),
                        loading = saving,
                    ) {
                        scope.launch {
                            saving = true
                            message = null
                            error = null
                            when (
                                val result = vm.authRepository.updateProfile(
                                    UpdateProfileInput(
                                        firstName = firstName.trim(),
                                        lastName = lastName.trim(),
                                        phone = phone.trim().ifBlank { null },
                                    ),
                                )
                            ) {
                                is Result.Success -> {
                                    firstName = result.data.firstName
                                    lastName = result.data.lastName
                                    phone = result.data.phone.orEmpty()
                                    message = "Profil güncellendi."
                                }
                                is Result.Error -> error = result.error.message
                            }
                            saving = false
                        }
                    }
                    message?.let {
                        Text(it, color = MaterialTheme.colorScheme.primary)
                    }
                    error?.let {
                        Text(it, color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }
}

@Composable
fun OrdersRoute(onOrderClick: (String) -> Unit, onBack: () -> Unit = {}, vm: AccountDataViewModel = hiltViewModel()) {
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
fun FavoritesRoute(
    onProductClick: (String) -> Unit,
    onBack: () -> Unit = {},
    vm: AccountDataViewModel = hiltViewModel(),
) {
    var products by remember { mutableStateOf<List<Product>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun load() {
        scope.launch {
            products = null
            error = null
            when (val result = vm.favoriteRepository.getFavorites()) {
                is Result.Success -> products = result.data
                is Result.Error -> error = result.error.message
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Favorilerim", onBack = onBack)
        when {
            error != null && products == null -> FurkanError(error!!) { load() }
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
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun load() {
        scope.launch {
            addresses = null
            error = null
            when (val result = vm.accountRepository.getAddresses()) {
                is Result.Success -> addresses = result.data
                is Result.Error -> error = result.error.message
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Adreslerim", onBack = onBack)
        when {
            error != null && addresses == null -> FurkanError(error!!) { load() }
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
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun load() {
        scope.launch {
            alerts = null
            error = null
            when (val result = vm.accountRepository.getAlerts()) {
                is Result.Success -> alerts = result.data
                is Result.Error -> error = result.error.message
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Stok bildirimleri", onBack = onBack)
        when {
            error != null && alerts == null -> FurkanError(error!!) { load() }
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
fun CurrentAccountRoute(onBack: () -> Unit = {}, vm: AccountDataViewModel = hiltViewModel()) {
    var current by remember { mutableStateOf<CurrentAccount?>(null) }
    var txs by remember { mutableStateOf<List<AccountTransaction>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        error = null
        val accountResult = vm.accountRepository.getCurrentAccount()
        val txResult = vm.accountRepository.getTransactions()
        when (accountResult) {
            is Result.Success -> current = accountResult.data
            is Result.Error -> {
                current = null
                error = accountResult.error.message
            }
        }
        when (txResult) {
            is Result.Success -> txs = txResult.data
            is Result.Error -> {
                if (error == null) error = txResult.error.message
                if (accountResult is Result.Error) txs = emptyList()
            }
        }
        loading = false
        refreshing = false
    }

    LaunchedEffect(Unit) { load() }

    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Cari hesabım", onBack = onBack)
        when {
            loading -> FurkanLoading()
            error != null && current == null -> FurkanError(error!!) {
                scope.launch {
                    loading = true
                    load()
                }
            }
            else -> Column(Modifier.padding(FurkanSpacing.md)) {
                FurkanButton(
                    if (refreshing) "Yenileniyor…" else "Yenile",
                    Modifier.fillMaxWidth(),
                ) {
                    scope.launch {
                        refreshing = true
                        load()
                    }
                }
                Spacer(Modifier.height(FurkanSpacing.md))
                error?.let {
                    Text(it, color = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.height(FurkanSpacing.sm))
                }
                current?.let {
                    Text(
                        "Güncel bakiye: ${it.balance} ${it.currency}",
                        style = MaterialTheme.typography.headlineLarge,
                    )
                    Text("Borç: ${it.debit.orEmpty()}")
                    Text("Alacak: ${it.credit.orEmpty()}")
                }
                Spacer(Modifier.height(FurkanSpacing.lg))
                if (txs.isEmpty()) {
                    FurkanEmptyState(
                        title = "Hareket yok",
                        message = "Cari hesap hareketleriniz burada listelenir.",
                    )
                } else {
                    txs.forEach {
                        Text("${it.createdAt}")
                        Text("${it.description.orEmpty()} · ${it.type} ${it.amount}")
                        Spacer(Modifier.height(FurkanSpacing.sm))
                    }
                }
            }
        }
    }
}

@Composable
fun BankTransfersRoute(orderId: String? = null, onBack: () -> Unit = {}, vm: AccountDataViewModel = hiltViewModel()) {
    var items by remember { mutableStateOf<List<BankTransfer>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var sender by remember { mutableStateOf("") }
    var date by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun load() {
        scope.launch {
            items = null
            error = null
            when (val result = vm.accountRepository.getBankTransfers()) {
                is Result.Success -> items = result.data
                is Result.Error -> error = result.error.message
            }
        }
    }

    LaunchedEffect(Unit) { load() }

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
                error != null && items == null -> FurkanError(error!!) { load() }
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
fun LegalDocumentRoute(slug: String, onBack: () -> Unit, vm: AccountDataViewModel = hiltViewModel()) {
    var page by remember { mutableStateOf<LegalPage?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun load() {
        scope.launch {
            page = null
            error = null
            when (val result = vm.accountRepository.getLegalPage(slug)) {
                is Result.Success -> page = result.data
                is Result.Error -> error = result.error.message
            }
        }
    }

    LaunchedEffect(slug) { load() }

    Column(Modifier.fillMaxSize()) {
        FurkanTopBar(page?.title ?: "Yasal metin", onBack = onBack)
        when {
            error != null && page == null -> FurkanError(error!!) { load() }
            page == null -> FurkanLoading()
            else -> {
                Column(Modifier.padding(FurkanSpacing.md)) {
                    Text(
                        "Son güncelleme: ${page!!.updatedAt}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Spacer(Modifier.height(FurkanSpacing.md))
                    Text(page!!.body)
                }
            }
        }
    }
}

@Composable
private fun preferenceToggle(label: String, enabled: Boolean, onToggle: (Boolean) -> Unit) {
    Text(
        if (enabled) "✓ $label" else label,
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onToggle(!enabled) }
            .padding(vertical = FurkanSpacing.sm),
    )
}
