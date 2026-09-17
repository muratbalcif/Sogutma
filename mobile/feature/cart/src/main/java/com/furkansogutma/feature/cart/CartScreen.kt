package com.furkansogutma.feature.cart

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.core.designsystem.components.FurkanButton
import com.furkansogutma.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.core.designsystem.components.FurkanPrice
import com.furkansogutma.core.designsystem.theme.FurkanSpacing

@Composable
fun CartRoute(
    onCheckout: () -> Unit,
    onBrowse: () -> Unit,
    viewModel: CartViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    when (val s = state) {
        CartUiState.Loading -> FurkanLoading()
        is CartUiState.Error -> FurkanError(s.message) { viewModel.onEvent(CartEvent.Retry) }
        is CartUiState.Success -> {
            if (s.cart.items.isEmpty()) {
                FurkanEmptyState("Sepetiniz boş", "Ürün ekleyerek başlayın", "Ürünlere git", onBrowse)
            } else {
                CartScreen(s, viewModel::onEvent, onCheckout)
            }
        }
    }
}

@Composable
fun CartScreen(
    state: CartUiState.Success,
    onEvent: (CartEvent) -> Unit,
    onCheckout: () -> Unit,
) {
    val cart = state.cart
    Column(
        Modifier
            .fillMaxSize()
            .padding(FurkanSpacing.md)
            .semantics { contentDescription = "Cart" },
    ) {
        Text("Sepet", style = MaterialTheme.typography.headlineLarge)
        LazyColumn(Modifier.weight(1f)) {
            items(cart.items, key = { it.productId }) { item ->
                Column(Modifier.padding(vertical = FurkanSpacing.sm)) {
                    Text(item.product.name, style = MaterialTheme.typography.titleMedium)
                    FurkanPrice(item.unitPrice)
                    Row {
                        FurkanOutlinedButton("-") { onEvent(CartEvent.UpdateQty(item.productId, item.quantity - 1)) }
                        Text("${item.quantity}", modifier = Modifier.padding(horizontal = FurkanSpacing.md))
                        FurkanOutlinedButton("+") { onEvent(CartEvent.UpdateQty(item.productId, item.quantity + 1)) }
                        Spacer(Modifier.weight(1f))
                        FurkanOutlinedButton("Sil") { onEvent(CartEvent.Remove(item.productId)) }
                    }
                    Text("Ara toplam: ${item.lineTotal} ${item.currency}")
                }
            }
        }
        Text("Ara toplam: ${cart.subtotal}")
        cart.taxAmount?.let { Text("KDV: $it") }
        cart.discountAmount?.let { Text("İndirim: $it") }
        Text("Toplam: ${cart.total} ${cart.currency}", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(FurkanSpacing.md))
        FurkanButton("Ödemeye geç", Modifier.fillMaxWidth(), onClick = onCheckout)
    }
}
