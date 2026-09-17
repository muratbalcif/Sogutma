package com.furkansogutma.feature.cart

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.core.designsystem.components.FurkanButton
import com.furkansogutma.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.components.FurkanNetworkImage
import com.furkansogutma.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.core.designsystem.components.FurkanPrice
import com.furkansogutma.core.designsystem.components.FurkanQtyStepper
import com.furkansogutma.core.designsystem.components.FurkanStickyBottomBar
import com.furkansogutma.core.designsystem.components.FurkanTopBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing

@Composable
fun CartRoute(
    onCheckout: () -> Unit,
    onBrowse: () -> Unit,
    viewModel: CartViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(Unit) {
        viewModel.effects.collect { effect ->
            when (effect) {
                CartEffect.ProceedCheckout -> onCheckout()
                is CartEffect.Message -> snackbar.showSnackbar(effect.text)
            }
        }
    }
    Scaffold(
        topBar = { FurkanTopBar(title = "Sepetim") },
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            val success = state as? CartUiState.Success
            if (success != null && success.cart.items.isNotEmpty()) {
                FurkanStickyBottomBar {
                    FurkanButton("Ödemeye Geç", Modifier.fillMaxWidth()) {
                        viewModel.onEvent(CartEvent.ValidateForCheckout)
                    }
                }
            }
        },
    ) { padding ->
        when (val s = state) {
            CartUiState.Loading -> FurkanLoading(Modifier.padding(padding))
            is CartUiState.Error -> FurkanError(s.message, Modifier.padding(padding)) { viewModel.onEvent(CartEvent.Retry) }
            is CartUiState.Success -> {
                if (s.cart.items.isEmpty()) {
                    FurkanEmptyState("Sepetiniz boş", "Alışverişe başlamak için ürünlere göz atın.", "Alışverişe Başla", onBrowse, Modifier.padding(padding))
                } else {
                    CartScreen(s, viewModel::onEvent, Modifier.padding(padding))
                }
            }
        }
    }
}

@Composable
fun CartScreen(
    state: CartUiState.Success,
    onEvent: (CartEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    val cart = state.cart
    Column(modifier.fillMaxSize().semantics { contentDescription = "Cart" }.padding(FurkanSpacing.md)) {
        if (state.validation != null && !state.validation.valid) {
            Text(
                "Sepetinizdeki bazı ürünlerde sorun var. Güncel fiyat ve stok bilgilerini kontrol edin.",
                color = MaterialTheme.colorScheme.error,
            )
            Spacer(Modifier.height(FurkanSpacing.sm))
        }
        LazyColumn(Modifier.weight(1f)) {
            items(cart.items, key = { it.productId }) { item ->
                Row(Modifier.padding(vertical = FurkanSpacing.sm)) {
                    FurkanNetworkImage(item.imageUrl, item.name, Modifier.size(72.dp))
                    Spacer(Modifier.width(FurkanSpacing.sm))
                    Column(Modifier.weight(1f)) {
                        Text(item.name, style = MaterialTheme.typography.titleMedium)
                        Text("SKU: ${item.sku}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        item.unitPrice?.let { FurkanPrice(it) }
                        if (!item.available) {
                            Text("Stok yetersiz", color = MaterialTheme.colorScheme.error)
                        }
                        FurkanQtyStepper(
                            quantity = item.quantity,
                            onDecrement = { onEvent(CartEvent.UpdateQty(item.productId, item.quantity - 1)) },
                            onIncrement = { onEvent(CartEvent.UpdateQty(item.productId, item.quantity + 1)) },
                        )
                        FurkanOutlinedButton("Sil") { onEvent(CartEvent.Remove(item.productId)) }
                    }
                }
            }
        }
        Text("Ara toplam: ${cart.subtotal} ${cart.currency}")
        Text("İndirim: ${cart.discountAmount} ${cart.currency}")
        Text("Toplam: ${cart.total} ${cart.currency}", style = MaterialTheme.typography.titleLarge)
    }
}
