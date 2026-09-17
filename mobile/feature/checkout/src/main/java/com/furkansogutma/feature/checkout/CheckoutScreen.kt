package com.furkansogutma.feature.checkout

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.designsystem.components.FurkanButton
import com.furkansogutma.core.designsystem.components.FurkanCheckoutStepper
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.core.designsystem.components.FurkanStickyBottomBar
import com.furkansogutma.core.designsystem.components.FurkanTextField
import com.furkansogutma.core.designsystem.components.FurkanTopBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.account.Address
import com.furkansogutma.domain.account.AddressInput
import com.furkansogutma.domain.account.CompanyBankAccount
import com.furkansogutma.domain.cart.GetCartUseCase
import com.furkansogutma.domain.order.CreateOrderInput
import com.furkansogutma.domain.order.CreateOrderUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CheckoutUiModel(
    val addresses: List<Address> = emptyList(),
    val total: String? = null,
    val bankAccounts: List<CompanyBankAccount> = emptyList(),
    val loading: Boolean = true,
    val submitting: Boolean = false,
    val error: String? = null,
)

sealed interface CheckoutEffect {
    data class OrderCreated(val orderId: String, val paymentMethod: String) : CheckoutEffect
    data class Message(val text: String) : CheckoutEffect
}

@HiltViewModel
class CheckoutViewModel @Inject constructor(
    private val accountRepository: AccountRepository,
    private val getCart: GetCartUseCase,
    private val createOrder: CreateOrderUseCase,
) : ViewModel() {
    private val _ui = MutableStateFlow(CheckoutUiModel())
    val ui = _ui.asStateFlow()
    private val _effects = MutableSharedFlow<CheckoutEffect>()
    val effects = _effects.asSharedFlow()

    init {
        viewModelScope.launch {
            val addresses = accountRepository.getAddresses()
            val cart = getCart()
            val banks = accountRepository.getBankAccounts()
            _ui.value = CheckoutUiModel(
                addresses = (addresses as? Result.Success)?.data.orEmpty(),
                total = (cart as? Result.Success)?.let { "${it.data.total} ${it.data.currency}" },
                bankAccounts = (banks as? Result.Success)?.data.orEmpty(),
                loading = false,
                error = listOf(addresses, cart)
                    .filterIsInstance<Result.Error>()
                    .firstOrNull()?.error?.message,
            )
        }
    }

    fun createAddress(input: AddressInput, onDone: () -> Unit) {
        viewModelScope.launch {
            when (val result = accountRepository.createAddress(input)) {
                is Result.Success -> {
                    val list = accountRepository.getAddresses()
                    if (list is Result.Success) {
                        _ui.value = _ui.value.copy(addresses = list.data)
                    }
                    onDone()
                }
                is Result.Error -> _effects.emit(CheckoutEffect.Message(result.error.message))
            }
        }
    }

    fun placeOrder(addressId: String) {
        if (_ui.value.submitting) return
        viewModelScope.launch {
            _ui.value = _ui.value.copy(submitting = true, error = null)
            when (
                val result = createOrder(
                    CreateOrderInput(
                        shippingAddressId = addressId,
                        billingAddressId = addressId,
                        paymentMethod = "BANK_TRANSFER",
                    ),
                )
            ) {
                is Result.Success -> {
                    _ui.value = _ui.value.copy(submitting = false)
                    _effects.emit(CheckoutEffect.OrderCreated(result.data.id, "BANK_TRANSFER"))
                }
                is Result.Error -> {
                    _ui.value = _ui.value.copy(submitting = false, error = result.error.message)
                    _effects.emit(CheckoutEffect.Message(result.error.message))
                }
            }
        }
    }
}
@Composable
fun CheckoutRoute(
    onOrderCreated: (orderId: String, paymentMethod: String) -> Unit,
    onBack: () -> Unit = {},
    onManageAddresses: () -> Unit = {},
    viewModel: CheckoutViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    var step by remember { mutableIntStateOf(1) }
    var selectedAddress by remember { mutableStateOf<String?>(null) }
    var showNewAddress by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        viewModel.effects.collect { effect ->
            when (effect) {
                is CheckoutEffect.OrderCreated -> onOrderCreated(effect.orderId, effect.paymentMethod)
                is CheckoutEffect.Message -> snackbar.showSnackbar(effect.text)
            }
        }
    }

    if (ui.loading) {
        FurkanLoading()
        return
    }

    Scaffold(
        topBar = { FurkanTopBar(title = "Ödeme", onBack = onBack) },
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            FurkanStickyBottomBar {
                when (step) {
                    1 -> FurkanButton(
                        text = "Devam",
                        modifier = Modifier.fillMaxWidth(),
                        enabled = selectedAddress != null,
                    ) { step = 2 }
                    2 -> FurkanButton("Onaya geç", Modifier.fillMaxWidth()) { step = 3 }
                    else -> FurkanButton(
                        text = "Siparişi Oluştur",
                        modifier = Modifier.fillMaxWidth(),
                        loading = ui.submitting,
                    ) {
                        selectedAddress?.let { viewModel.placeOrder(it) }
                    }
                }
            }
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(FurkanSpacing.md)
                .verticalScroll(rememberScrollState()),
        ) {
            FurkanCheckoutStepper(currentStep = step)
            Spacer(Modifier.height(FurkanSpacing.md))
            when (step) {
                1 -> {
                    Text("Teslimat adresi", style = MaterialTheme.typography.titleLarge)
                    Spacer(Modifier.height(FurkanSpacing.sm))
                    ui.addresses.forEach { address ->
                        RowClickableAddress(
                            address = address,
                            selected = selectedAddress == address.id,
                            onClick = { selectedAddress = address.id },
                        )
                    }
                    Spacer(Modifier.height(FurkanSpacing.sm))
                    FurkanOutlinedButton("+ Yeni Adres", Modifier.fillMaxWidth()) {
                        showNewAddress = !showNewAddress
                    }
                    if (showNewAddress) {
                        AddressCreateForm { input ->
                            viewModel.createAddress(input) {
                                showNewAddress = false
                            }
                        }
                    }
                    FurkanOutlinedButton("Adreslerimi yönet", Modifier.fillMaxWidth(), onClick = onManageAddresses)
                }
                2 -> {
                    Text("Ödeme yöntemi", style = MaterialTheme.typography.titleLarge)
                    PaymentOption("Havale / EFT", selected = true) {}
                    Text(
                        "İlk sürümde tek ödeme yöntemi havale/EFT'dir.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(FurkanSpacing.md))
                    Text("Banka bilgileri", style = MaterialTheme.typography.titleMedium)
                    if (ui.bankAccounts.isEmpty()) {
                        Text("Aktif banka hesabı bulunamadı.")
                    } else {
                        ui.bankAccounts.forEach { bank ->
                            Spacer(Modifier.height(FurkanSpacing.sm))
                            Text(bank.bankName, style = MaterialTheme.typography.titleSmall)
                            Text(bank.accountName)
                            Text(bank.iban)
                            FurkanOutlinedButton("IBAN Kopyala", Modifier.fillMaxWidth()) {
                                val clipboard =
                                    context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                clipboard.setPrimaryClip(ClipData.newPlainText("IBAN", bank.iban))
                            }
                        }
                    }
                }
                else -> {
                    Text("Sipariş onayı", style = MaterialTheme.typography.titleLarge)
                    Text("Adres: ${ui.addresses.firstOrNull { it.id == selectedAddress }?.fullName.orEmpty()}")
                    Text("Ödeme: Havale / EFT")
                    Text("Toplam: ${ui.total.orEmpty()}", style = MaterialTheme.typography.titleMedium)
                    ui.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            }
        }
    }
}

@Composable
private fun RowClickableAddress(address: Address, selected: Boolean, onClick: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = FurkanSpacing.sm),
    ) {
        androidx.compose.foundation.layout.Row {
            RadioButton(selected = selected, onClick = onClick)
            Column {
                Text(address.title, style = MaterialTheme.typography.titleMedium)
                Text("${address.fullName} · ${address.phone}")
                Text("${address.addressLine}, ${address.district}/${address.city}")
                if (address.isDefault) Text("Varsayılan", color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

@Composable
private fun PaymentOption(label: String, selected: Boolean, onClick: () -> Unit) {
    androidx.compose.foundation.layout.Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = FurkanSpacing.xs),
    ) {
        RadioButton(selected = selected, onClick = onClick)
        Text(label, modifier = Modifier.padding(top = FurkanSpacing.sm))
    }
}

@Composable
private fun AddressCreateForm(onSubmit: (AddressInput) -> Unit) {
    var title by remember { mutableStateOf("Ev") }
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var district by remember { mutableStateOf("") }
    var addressLine by remember { mutableStateOf("") }
    var postalCode by remember { mutableStateOf("") }
    Column {
        FurkanTextField(title, { title = it }, "Adres başlığı")
        FurkanTextField(firstName, { firstName = it }, "Ad")
        FurkanTextField(lastName, { lastName = it }, "Soyad")
        FurkanTextField(phone, { phone = it }, "Telefon", keyboardType = KeyboardType.Phone)
        FurkanTextField(city, { city = it }, "İl")
        FurkanTextField(district, { district = it }, "İlçe")
        FurkanTextField(addressLine, { addressLine = it }, "Adres")
        FurkanTextField(postalCode, { postalCode = it }, "Posta kodu", keyboardType = KeyboardType.Number)
        FurkanButton("Adresi kaydet", Modifier.fillMaxWidth()) {
            onSubmit(
                AddressInput(
                    title = title,
                    firstName = firstName,
                    lastName = lastName,
                    phone = phone,
                    city = city,
                    district = district,
                    addressLine = addressLine,
                    postalCode = postalCode.ifBlank { null },
                    isDefault = false,
                ),
            )
        }
    }
}

@Composable
fun OrderSuccessRoute(
    orderId: String,
    paymentMethod: String,
    onViewOrder: (String) -> Unit,
    onContinueShopping: () -> Unit,
    onBankTransfer: (String) -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(FurkanSpacing.xl)) {
        Text("Siparişiniz oluşturuldu.", style = MaterialTheme.typography.headlineLarge)
        Spacer(Modifier.height(FurkanSpacing.sm))
        Text("Sipariş No: $orderId")
        Text("Ödeme yöntemi: Havale / EFT")
        Text("Ödeme durumu: Ödeme bekleniyor")
        Spacer(Modifier.height(FurkanSpacing.lg))
        FurkanButton("Siparişi Görüntüle", Modifier.fillMaxWidth()) { onViewOrder(orderId) }
        Spacer(Modifier.height(FurkanSpacing.sm))
        FurkanOutlinedButton("Alışverişe Devam Et", Modifier.fillMaxWidth(), onClick = onContinueShopping)
        if (paymentMethod == "BANK_TRANSFER") {
            Spacer(Modifier.height(FurkanSpacing.sm))
            FurkanButton("Havale Bildirimi Yap", Modifier.fillMaxWidth()) { onBankTransfer(orderId) }
        }
    }
}
