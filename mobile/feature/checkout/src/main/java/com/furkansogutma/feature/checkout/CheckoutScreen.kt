package com.furkansogutma.feature.checkout

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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.designsystem.components.FurkanButton
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.account.Address
import com.furkansogutma.domain.cart.GetCartUseCase
import com.furkansogutma.domain.order.CreateOrderInput
import com.furkansogutma.domain.order.CreateOrderUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class CheckoutViewModel @Inject constructor(
    private val accountRepository: AccountRepository,
    private val getCart: GetCartUseCase,
    private val createOrder: CreateOrderUseCase,
) : ViewModel() {
    private val _addresses = MutableStateFlow<List<Address>>(emptyList())
    val addresses = _addresses.asStateFlow()
    private val _total = MutableStateFlow<String?>(null)
    val total = _total.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()

    init {
        viewModelScope.launch {
            when (val result = accountRepository.getAddresses()) {
                is Result.Success -> _addresses.value = result.data
                is Result.Error -> _error.value = result.error.message
            }
            when (val cart = getCart()) {
                is Result.Success -> _total.value = "${cart.data.total} ${cart.data.currency}"
                is Result.Error -> _error.value = cart.error.message
            }
        }
    }

    fun placeOrder(addressId: String, paymentMethod: String, onSuccess: (String) -> Unit) {
        viewModelScope.launch {
            when (
                val result = createOrder(
                    CreateOrderInput(shippingAddressId = addressId, paymentMethod = paymentMethod),
                )
            ) {
                is Result.Success -> onSuccess(result.data.id)
                is Result.Error -> _error.value = result.error.message
            }
        }
    }
}

@Composable
fun CheckoutRoute(
    onOrderCreated: (String) -> Unit,
    viewModel: CheckoutViewModel = hiltViewModel(),
) {
    var step by remember { mutableIntStateOf(1) }
    var selectedAddress by remember { mutableStateOf<String?>(null) }
    var paymentMethod by remember { mutableStateOf("BANK_TRANSFER") }
    var addresses by remember { mutableStateOf<List<Address>>(emptyList()) }
    var total by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        launch { viewModel.addresses.collect { addresses = it; loading = false } }
        launch { viewModel.total.collect { total = it } }
        launch { viewModel.error.collect { error = it } }
    }

    if (loading) {
        FurkanLoading()
        return
    }

    Column(Modifier.fillMaxSize().padding(FurkanSpacing.md)) {
        Text("Checkout — Adım $step/3", style = MaterialTheme.typography.headlineLarge)
        Spacer(Modifier.height(FurkanSpacing.md))
        when (step) {
            1 -> {
                Text("Adres seçin")
                LazyColumn(Modifier.weight(1f)) {
                    items(addresses, key = { it.id }) { address ->
                        Text(
                            "${address.fullName} — ${address.city}/${address.district}",
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedAddress = address.id }
                                .padding(FurkanSpacing.sm),
                        )
                    }
                }
                FurkanButton(
                    text = "Devam",
                    modifier = Modifier.fillMaxWidth(),
                    enabled = selectedAddress != null,
                ) {
                    if (selectedAddress != null) step = 2
                }
            }
            2 -> {
                Text("Ödeme yöntemi")
                FurkanButton(
                    text = if (paymentMethod == "BANK_TRANSFER") "Havale/EFT (seçili)" else "Havale/EFT",
                    modifier = Modifier.fillMaxWidth(),
                ) { paymentMethod = "BANK_TRANSFER" }
                Spacer(Modifier.height(FurkanSpacing.sm))
                FurkanButton(
                    text = if (paymentMethod == "CREDIT_CARD") "Online ödeme (seçili)" else "Online ödeme",
                    modifier = Modifier.fillMaxWidth(),
                ) { paymentMethod = "CREDIT_CARD" }
                Spacer(Modifier.height(FurkanSpacing.md))
                FurkanButton("Onaya geç", Modifier.fillMaxWidth()) { step = 3 }
            }
            else -> {
                Text("Sipariş onayı")
                Text("Adres: $selectedAddress")
                Text("Ödeme: $paymentMethod")
                Text("Toplam: ${total.orEmpty()}")
                if (error != null) Text(error!!, color = MaterialTheme.colorScheme.error)
                Spacer(Modifier.height(FurkanSpacing.md))
                FurkanButton("Siparişi oluştur", Modifier.fillMaxWidth()) {
                    selectedAddress?.let { id ->
                        viewModel.placeOrder(id, paymentMethod, onOrderCreated)
                    }
                }
            }
        }
    }
}
