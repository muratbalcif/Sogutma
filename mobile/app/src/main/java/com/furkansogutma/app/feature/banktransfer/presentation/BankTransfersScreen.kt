package com.furkansogutma.app.feature.banktransfer.presentation

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
fun BankTransfersRoute(orderId: String? = null, onBack: () -> Unit = {}, vm: BankTransfersViewModel = hiltViewModel()) {
    var items by remember { mutableStateOf<List<BankTransfer>?>(null) }
    var banks by remember { mutableStateOf<List<com.furkansogutma.app.feature.account.domain.model.CompanyBankAccount>>(emptyList()) }
    var banksLoading by remember { mutableStateOf(true) }
    var banksError by remember { mutableStateOf<String?>(null) }
    var order by remember { mutableStateOf<Order?>(null) }
    var orderError by remember { mutableStateOf<String?>(null) }
    var selectedBankId by remember { mutableStateOf<String?>(null) }
    var amountInput by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current
    val selectedColor = Color(0xFF0F766E)

    fun load() {
        scope.launch {
            items = null
            error = null
            banksLoading = true
            banksError = null
            orderError = null
            when (val banksResult = vm.accountRepository.getBankAccounts()) {
                is Result.Success -> {
                    banks = banksResult.data
                    banksError = null
                }
                is Result.Error -> {
                    banks = emptyList()
                    banksError = banksResult.error.message
                }
            }
            banksLoading = false
            when (val result = vm.accountRepository.getBankTransfers()) {
                is Result.Success -> items = result.data
                is Result.Error -> if (error == null) error = result.error.message
            }
            if (orderId != null) {
                when (val orderResult = vm.getOrder(orderId)) {
                    is Result.Success -> {
                        order = orderResult.data
                        val remaining = orderResult.data.paymentRemainingAmount
                            ?: orderResult.data.total
                        if (orderResult.data.pendingBankTransferId.isNullOrBlank()) {
                            amountInput = remaining
                        }
                    }
                    is Result.Error -> {
                        orderError = orderResult.error.message
                        if (error == null) error = orderResult.error.message
                    }
                }
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    fun copy(label: String, value: String) {
        val clipboard =
            context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText(label, value))
        message = "$label kopyalandı"
    }

    val claimState = bankTransferClaimUiState(
        paymentMethod = order?.paymentMethod ?: "BANK_TRANSFER",
        paymentStatus = order?.paymentStatus,
        remainingAmount = order?.paymentRemainingAmount ?: order?.total,
        pendingBankTransferId = order?.pendingBankTransferId,
    )
    val isPendingReview = claimState == BankTransferClaimUiState.PendingReview
    val formDisabled = isPendingReview || submitting
    val remaining = order?.paymentRemainingAmount ?: order?.total
    val pendingAmount = order?.pendingBankTransferAmount
        ?: items?.firstOrNull {
            it.status == "PENDING" && (orderId == null || it.orderId == orderId)
        }?.amount
    val pendingBankName = order?.pendingBankTransferBankName
        ?: items?.firstOrNull {
            it.status == "PENDING" && (orderId == null || it.orderId == orderId)
        }?.bankName
    val pendingReference = order?.pendingBankTransferReference
        ?: items?.firstOrNull {
            it.status == "PENDING" && (orderId == null || it.orderId == orderId)
        }?.referenceNumber
        ?: order?.paymentReference

    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Havale / EFT ile Öde", onBack = onBack)
        Column(Modifier.padding(FurkanSpacing.md).verticalScroll(rememberScrollState())) {
            if (orderId != null && orderError != null && order == null) {
                Text(orderError!!, color = MaterialTheme.colorScheme.error)
                FurkanOutlinedButton("Tekrar dene", Modifier.fillMaxWidth()) { load() }
                Spacer(Modifier.height(FurkanSpacing.lg))
            }
            if (orderId != null && claimState == BankTransferClaimUiState.Hidden && order != null) {
                Text(
                    "Bu sipariş için yeni havale bildirimi gerekmiyor.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(FurkanSpacing.lg))
            }
            if (orderId != null && claimState != BankTransferClaimUiState.Hidden) {
                if (isPendingReview) {
                    Text(
                        "Ödeme bildiriminiz inceleniyor",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF92400E),
                    )
                    Text(
                        "İnceleme tamamlanana kadar yeni bildirim gönderemezsiniz.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text("Bildirilen tutar: ${formatTryDisplay(pendingAmount)}")
                    Text("Banka: ${pendingBankName ?: "—"}")
                    Text("Referans: ${pendingReference ?: "—"}")
                    Spacer(Modifier.height(FurkanSpacing.md))
                }

                Text("Banka hesapları", style = MaterialTheme.typography.titleLarge)
                Text(
                    "Bu bankada hesabınız olmasa da kendi bankanızdan EFT/havale yapabilirsiniz.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(FurkanSpacing.sm))
                when {
                    banksLoading -> FurkanLoading()
                    banksError != null -> {
                        Text(banksError!!, color = MaterialTheme.colorScheme.error)
                        FurkanOutlinedButton("Tekrar dene", Modifier.fillMaxWidth()) { load() }
                    }
                    banks.isEmpty() -> FurkanEmptyState(
                        "Aktif banka hesabı yok",
                        "Şu an havale için gösterilecek şirket hesabı bulunmuyor.",
                    )
                    else -> banks.forEach { bank ->
                        val selected = selectedBankId == bank.id
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = FurkanSpacing.sm)
                                .border(
                                    width = if (selected) 2.dp else 1.dp,
                                    color = if (selected) selectedColor else MaterialTheme.colorScheme.outline,
                                    shape = RoundedCornerShape(12.dp),
                                )
                                .clickable(enabled = !formDisabled) { selectedBankId = bank.id }
                                .padding(FurkanSpacing.sm),
                        ) {
                            Text(
                                bank.bankName,
                                fontWeight = FontWeight.SemiBold,
                                color = if (selected) selectedColor else MaterialTheme.colorScheme.onSurface,
                            )
                            Text(bank.accountName)
                            Text(bank.iban, fontWeight = FontWeight.Medium)
                            bank.branch?.let { Text("Şube: $it", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                            if (selected) {
                                Text("Seçildi", color = selectedColor, fontWeight = FontWeight.Bold)
                            }
                            FurkanOutlinedButton("IBAN'ı Kopyala", Modifier.fillMaxWidth()) {
                                copy("IBAN", bank.iban)
                            }
                        }
                    }
                }

                Spacer(Modifier.height(FurkanSpacing.md))
                Text("Ödeme özeti", style = MaterialTheme.typography.titleMedium)
                Text("Toplam: ${formatTryDisplay(order?.total)}")
                Text("Ödenen: ${formatTryDisplay(order?.paymentApprovedTotal ?: "0.00")}")
                Text("Kalan: ${formatTryDisplay(remaining)}")
                val reference = order?.paymentReference
                Text("Referans: ${reference ?: "—"}")
                remaining?.let {
                    FurkanOutlinedButton("Kalan Tutarı Kopyala", Modifier.fillMaxWidth()) {
                        copy("Tutar", it)
                    }
                }
                reference?.let {
                    FurkanOutlinedButton("Referansı Kopyala", Modifier.fillMaxWidth()) {
                        copy("Referans", it)
                    }
                }

                if (!isPendingReview) {
                    Spacer(Modifier.height(FurkanSpacing.sm))
                    FurkanTextField(
                        value = amountInput,
                        onValueChange = { amountInput = it },
                        label = "Ödeme tutarı",
                        keyboardType = KeyboardType.Decimal,
                        enabled = !formDisabled,
                        supportingText = remaining?.let {
                            "Varsayılan kalan: ${formatTryDisplay(it)}" +
                                (toApiMoneyAmount(amountInput)?.let { api ->
                                    " · Bildirilecek: ${formatTryDisplay(api)}"
                                } ?: "")
                        },
                    )
                    toApiMoneyAmount(amountInput)?.let { apiAmount ->
                        FurkanOutlinedButton("Tutarı Kopyala", Modifier.fillMaxWidth()) {
                            copy("Tutar", apiAmount)
                        }
                    }
                }

                Spacer(Modifier.height(FurkanSpacing.sm))
                FurkanButton(
                    text = when {
                        submitting -> "Gönderiliyor…"
                        isPendingReview -> "İnceleniyor"
                        else -> "Ödemeyi Yaptım"
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !formDisabled && claimState == BankTransferClaimUiState.CanClaim && selectedBankId != null,
                    loading = submitting,
                ) {
                    scope.launch {
                        if (claimState != BankTransferClaimUiState.CanClaim) {
                            message = "Ödeme bildiriminiz inceleniyor"
                            return@launch
                        }
                        val bankId = selectedBankId
                        if (bankId == null) {
                            message = "Lütfen bir banka hesabı seçin"
                            return@launch
                        }
                        val amount = toApiMoneyAmount(amountInput)
                        if (amount == null) {
                            message = "Geçerli bir tutar girin (0'dan büyük)"
                            return@launch
                        }
                        val remainingValue = remaining?.let { runCatching { BigDecimal(it) }.getOrNull() }
                        val claimValue = BigDecimal(amount)
                        if (remainingValue != null && claimValue > remainingValue) {
                            message = "Tutar kalan bakiyeyi aşamaz (${formatTryDisplay(remaining)})"
                            return@launch
                        }
                        submitting = true
                        message = null
                        when (
                            val result = vm.accountRepository.createBankTransfer(
                                orderId = orderId,
                                bankAccountId = bankId,
                                amount = amount,
                            )
                        ) {
                            is Result.Success -> {
                                message = "Ödeme bildiriminiz alındı."
                                items = listOf(result.data) + (items.orEmpty())
                                load()
                            }
                            is Result.Error -> message = result.error.message
                        }
                        submitting = false
                    }
                }
                message?.let {
                    Text(
                        it,
                        color = if (it.contains("aşamaz") || it.contains("seçin") || it.contains("Geçerli") || it.contains("inceleniyor")) {
                            MaterialTheme.colorScheme.error
                        } else {
                            selectedColor
                        },
                    )
                }
                Spacer(Modifier.height(FurkanSpacing.lg))
            }
            Text("Bildirim geçmişi", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(FurkanSpacing.sm))
            when {
                error != null && items == null -> FurkanError(error!!) { load() }
                items == null -> FurkanLoading()
                items!!.isEmpty() -> FurkanEmptyState("Havale yok", "Havale bildirimleriniz burada.")
                else -> items!!.forEach {
                    Text(
                        "${formatTryDisplay(it.amount)} — ${transferStatusLabel(it.status)}",
                        fontWeight = FontWeight.Medium,
                    )
                    it.bankName?.let { name -> Text(name) }
                    it.referenceNumber?.let { ref -> Text("Referans: $ref") }
                    it.paymentStatus?.let { status ->
                        Text(
                            "Ödeme: $status" +
                                (it.approvedTotal?.let { t -> " · Ödenen ${formatTryDisplay(t)}" } ?: "") +
                                (it.remainingAmount?.let { r -> " · Kalan ${formatTryDisplay(r)}" } ?: ""),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(it.description.orEmpty())
                    Spacer(Modifier.height(FurkanSpacing.sm))
                }
            }
        }
    }
}
