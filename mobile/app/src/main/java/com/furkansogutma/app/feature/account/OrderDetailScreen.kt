package com.furkansogutma.app.feature.account

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.designsystem.components.FurkanButton
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.core.designsystem.components.FurkanTopBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.domain.order.Order
import kotlinx.coroutines.launch

@Composable
fun OrderDetailRoute(
    orderId: String,
    onBack: () -> Unit = {},
    vm: AccountDataViewModel = hiltViewModel(),
) {
    var order by remember { mutableStateOf<Order?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var cancelling by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    fun load() {
        scope.launch {
            when (val result = vm.getOrder(orderId)) {
                is Result.Success -> {
                    order = result.data
                    error = null
                }
                is Result.Error -> error = result.error.message
            }
        }
    }

    LaunchedEffect(orderId) { load() }

    Column(Modifier.fillMaxSize()) {
        FurkanTopBar("Sipariş detayı", onBack = onBack)
        when {
            error != null && order == null -> FurkanError(error!!, onRetry = { load() })
            order == null -> FurkanLoading()
            else -> OrderDetailContent(
                order = order!!,
                cancelling = cancelling,
                actionError = error,
                onOpenTracking = { url ->
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                },
                onCancel = {
                    scope.launch {
                        cancelling = true
                        when (val result = vm.cancelOrder(orderId)) {
                            is Result.Success -> {
                                order = result.data
                                error = null
                            }
                            is Result.Error -> error = result.error.message
                        }
                        cancelling = false
                    }
                },
            )
        }
    }
}

@Composable
fun OrderDetailContent(
    order: Order,
    cancelling: Boolean = false,
    actionError: String? = null,
    onOpenTracking: (String) -> Unit = {},
    onCancel: () -> Unit = {},
) {
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(FurkanSpacing.md),
    ) {
        Text(order.orderNumber, style = MaterialTheme.typography.headlineLarge)
        Text("Durum: ${order.status}", style = MaterialTheme.typography.titleMedium)
        order.paymentStatus?.let { Text("Ödeme durumu: $it") }
        order.paymentMethod?.let { Text("Ödeme yöntemi: $it") }
        order.paymentApprovedTotal?.let { Text("Ödenen: $it ${order.currency}") }
        order.paymentRemainingAmount?.let {
            if (order.paymentStatus == "PENDING" || order.paymentStatus == "PARTIALLY_PAID") {
                Text("Kalan: $it ${order.currency}")
            }
        }
        Text("Toplam: ${order.total} ${order.currency}")
        order.shippingSummary?.let {
            Spacer(Modifier.height(FurkanSpacing.sm))
            Text("Teslimat adresi", style = MaterialTheme.typography.titleLarge)
            Text(it)
        }

        val shipping = order.shipping
        if (shipping != null) {
            Spacer(Modifier.height(FurkanSpacing.md))
            Text("Kargo", style = MaterialTheme.typography.titleLarge)
            shipping.provider?.let { Text("Kargo firması: $it") }
            shipping.status?.let { Text("Kargo durumu: $it") }
            shipping.trackingNumber?.let { Text("Takip no: $it") }
            val trackingUrl = shipping.trackingUrl
            if (!trackingUrl.isNullOrBlank()) {
                Spacer(Modifier.height(FurkanSpacing.sm))
                FurkanButton("Kargoyu takip et", Modifier.fillMaxWidth()) {
                    onOpenTracking(trackingUrl)
                }
            }
        }

        Spacer(Modifier.height(FurkanSpacing.md))
        Text("Ürünler", style = MaterialTheme.typography.titleLarge)
        order.items.forEach {
            Text("${it.name} x${it.quantity}")
            Text("${it.unitPrice} → ${it.total}")
            Spacer(Modifier.height(FurkanSpacing.xs))
        }

        Spacer(Modifier.height(FurkanSpacing.md))
        Text("Sipariş geçmişi", style = MaterialTheme.typography.titleLarge)
        if (order.statusHistory.isEmpty()) {
            Text("Henüz durum kaydı yok.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            order.statusHistory.forEach { entry ->
                Text("${entry.createdAt}: ${entry.status}")
                entry.note?.takeIf { it.isNotBlank() }?.let {
                    Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(FurkanSpacing.xs))
            }
        }

        actionError?.let {
            Spacer(Modifier.height(FurkanSpacing.sm))
            Text(it, color = MaterialTheme.colorScheme.error)
        }

        if (order.canCancel) {
            Spacer(Modifier.height(FurkanSpacing.lg))
            FurkanOutlinedButton(
                text = if (cancelling) "İptal ediliyor…" else "Siparişi iptal et",
                modifier = Modifier.fillMaxWidth(),
                enabled = !cancelling,
                onClick = onCancel,
            )
        }
    }
}
