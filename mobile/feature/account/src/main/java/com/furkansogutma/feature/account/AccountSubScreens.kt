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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.account.AccountTransaction
import com.furkansogutma.domain.account.Address
import com.furkansogutma.domain.account.BankTransfer
import com.furkansogutma.domain.account.CurrentAccount
import com.furkansogutma.domain.account.ProductAlert
import com.furkansogutma.domain.favorite.FavoriteRepository
import com.furkansogutma.domain.order.GetOrderUseCase
import com.furkansogutma.domain.order.GetOrdersUseCase
import com.furkansogutma.domain.order.Order
import com.furkansogutma.domain.product.Product
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch

@HiltViewModel
class AccountDataViewModel @Inject constructor(
    val accountRepository: AccountRepository,
    val favoriteRepository: FavoriteRepository,
    val getOrders: GetOrdersUseCase,
    val getOrder: GetOrderUseCase,
) : ViewModel()

@Composable
fun OrdersRoute(onOrderClick: (String) -> Unit, vm: AccountDataViewModel = hiltViewModel()) {
    var orders by remember { mutableStateOf<List<Order>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        when (val result = vm.getOrders()) {
            is Result.Success -> orders = result.data
            is Result.Error -> error = result.error.message
        }
    }
    when {
        error != null -> FurkanError(error!!)
        orders == null -> FurkanLoading()
        orders!!.isEmpty() -> FurkanEmptyState("Sipariş yok", "Henüz siparişiniz bulunmuyor.")
        else -> LazyColumn(Modifier.fillMaxSize().padding(FurkanSpacing.md)) {
            items(orders!!, key = { it.id }) { order ->
                Column(
                    Modifier
                        .clickable { onOrderClick(order.id) }
                        .padding(vertical = FurkanSpacing.sm),
                ) {
                    Text(order.orderNumber, style = MaterialTheme.typography.titleMedium)
                    Text("${order.status} · ${order.total} ${order.currency}")
                }
            }
        }
    }
}

@Composable
fun OrderDetailRoute(orderId: String, vm: AccountDataViewModel = hiltViewModel()) {
    var order by remember { mutableStateOf<Order?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(orderId) {
        when (val result = vm.getOrder(orderId)) {
            is Result.Success -> order = result.data
            is Result.Error -> error = result.error.message
        }
    }
    when {
        error != null -> FurkanError(error!!)
        order == null -> FurkanLoading()
        else -> Column(Modifier.padding(FurkanSpacing.md)) {
            Text(order!!.orderNumber, style = MaterialTheme.typography.headlineLarge)
            Text(order!!.status)
            order!!.paymentStatus?.let { Text("Ödeme: $it") }
            order!!.items.forEach { Text("${it.name} x${it.quantity} = ${it.total}") }
            Text("Geçmiş")
            order!!.statusHistory.forEach { Text("${it.createdAt}: ${it.status}") }
        }
    }
}

@Composable
fun FavoritesRoute(onProductClick: (String) -> Unit, vm: AccountDataViewModel = hiltViewModel()) {
    var products by remember { mutableStateOf<List<Product>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        when (val result = vm.favoriteRepository.getFavorites()) {
            is Result.Success -> products = result.data
            is Result.Error -> error = result.error.message
        }
    }
    when {
        error != null -> FurkanError(error!!)
        products == null -> FurkanLoading()
        products!!.isEmpty() -> FurkanEmptyState("Favori yok", "Favori ürünleriniz burada görünür.")
        else -> LazyColumn(Modifier.padding(FurkanSpacing.md)) {
            items(products!!, key = { it.id }) { p ->
                Text(p.name, Modifier.clickable { onProductClick(p.slug) }.padding(FurkanSpacing.sm))
            }
        }
    }
}

@Composable
fun AddressesRoute(vm: AccountDataViewModel = hiltViewModel()) {
    var addresses by remember { mutableStateOf<List<Address>?>(null) }
    LaunchedEffect(Unit) {
        when (val result = vm.accountRepository.getAddresses()) {
            is Result.Success -> addresses = result.data
            is Result.Error -> addresses = emptyList()
        }
    }
    if (addresses == null) FurkanLoading()
    else if (addresses!!.isEmpty()) FurkanEmptyState("Adres yok", "Teslimat adresi ekleyin.")
    else LazyColumn(Modifier.padding(FurkanSpacing.md)) {
        items(addresses!!, key = { it.id }) {
            Text("${it.fullName} — ${it.city}/${it.district}${if (it.isDefault) " (varsayılan)" else ""}")
        }
    }
}

@Composable
fun AlertsRoute(vm: AccountDataViewModel = hiltViewModel()) {
    var alerts by remember { mutableStateOf<List<ProductAlert>?>(null) }
    LaunchedEffect(Unit) {
        when (val result = vm.accountRepository.getAlerts()) {
            is Result.Success -> alerts = result.data
            is Result.Error -> alerts = emptyList()
        }
    }
    if (alerts == null) FurkanLoading()
    else if (alerts!!.isEmpty()) FurkanEmptyState("Bildirim yok", "Stok bildirimleriniz burada.")
    else LazyColumn(Modifier.padding(FurkanSpacing.md)) {
        items(alerts!!, key = { it.id }) {
            Text("${it.productName ?: it.productId} — ${it.status.orEmpty()}")
        }
    }
}

@Composable
fun CommentsRoute() {
    FurkanEmptyState("Yorum yok", "Henüz yorumunuz bulunmuyor. (Comment API backend'de yok)")
}

@Composable
fun CurrentAccountRoute(vm: AccountDataViewModel = hiltViewModel()) {
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
    Column(Modifier.padding(FurkanSpacing.md)) {
        Text("Cari hesap", style = MaterialTheme.typography.headlineLarge)
        current?.let {
            Text("Bakiye: ${it.balance} ${it.currency}")
            Text("Borç: ${it.debit.orEmpty()}")
            Text("Alacak: ${it.credit.orEmpty()}")
        }
        txs.forEach { Text("${it.createdAt}: ${it.type} ${it.amount}") }
    }
}

@Composable
fun BankTransfersRoute(vm: AccountDataViewModel = hiltViewModel()) {
    var items by remember { mutableStateOf<List<BankTransfer>?>(null) }
    LaunchedEffect(Unit) {
        when (val result = vm.accountRepository.getBankTransfers()) {
            is Result.Success -> items = result.data
            is Result.Error -> items = emptyList()
        }
    }
    if (items == null) FurkanLoading()
    else if (items!!.isEmpty()) FurkanEmptyState("Havale yok", "Havale bildirimleriniz burada.")
    else LazyColumn(Modifier.padding(FurkanSpacing.md)) {
        items(items!!, key = { it.id }) {
            Text("${it.amount} — ${it.status} — ${it.description.orEmpty()}")
        }
    }
}

@Composable
fun SettingsRoute() {
    Column(Modifier.padding(FurkanSpacing.md)) {
        Text("Ayarlar", style = MaterialTheme.typography.headlineLarge)
        Text("Bildirim tercihleri ve uygulama ayarları yakında.")
    }
}
