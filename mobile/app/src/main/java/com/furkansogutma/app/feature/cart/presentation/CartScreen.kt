package com.furkansogutma.app.feature.cart.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.app.core.common.money.MoneyFormatter
import com.furkansogutma.app.core.designsystem.components.FurkanButton
import com.furkansogutma.app.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.app.core.designsystem.components.FurkanError
import com.furkansogutma.app.core.designsystem.components.FurkanLoading
import com.furkansogutma.app.core.designsystem.components.FurkanNetworkImage
import com.furkansogutma.app.core.designsystem.components.FurkanPrice
import com.furkansogutma.app.core.designsystem.components.FurkanQtyStepper
import com.furkansogutma.app.core.designsystem.components.FurkanStickyBottomBar
import com.furkansogutma.app.core.designsystem.components.FurkanSurfaceCard
import com.furkansogutma.app.core.designsystem.components.FurkanTopBar
import com.furkansogutma.app.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.app.feature.cart.domain.model.CartItem

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
        topBar = { FurkanTopBar(title = "Sepet") },
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            val success = state as? CartUiState.Success
            if (success != null && success.cart.items.isNotEmpty()) {
                val cart = success.cart
                FurkanStickyBottomBar {
                    Column(Modifier.fillMaxWidth()) {
                        SummaryLine("Ara toplam", MoneyFormatter.formatTry(cart.subtotal))
                        SummaryLine("İndirim", MoneyFormatter.formatTry(cart.discountAmount))
                        Spacer(Modifier.height(FurkanSpacing.xxs))
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "Toplam",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                MoneyFormatter.formatTry(cart.total),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                        Spacer(Modifier.height(FurkanSpacing.sm))
                        FurkanButton("Ödemeye Geç", Modifier.fillMaxWidth()) {
                            viewModel.onEvent(CartEvent.ValidateForCheckout)
                        }
                    }
                }
            }
        },
    ) { padding ->
        when (val s = state) {
            CartUiState.Loading -> FurkanLoading(Modifier.padding(padding))
            is CartUiState.Error -> FurkanError(s.message, Modifier.padding(padding)) {
                viewModel.onEvent(CartEvent.Retry)
            }
            is CartUiState.Success -> {
                if (s.cart.items.isEmpty()) {
                    FurkanEmptyState(
                        title = "Sepetinizde hiç ürün yok",
                        message = "Ürün ekleyerek alışverişe başlayın.",
                        actionLabel = "Alışverişe başla",
                        onAction = onBrowse,
                        modifier = Modifier.padding(padding),
                        icon = Icons.Default.ShoppingCart,
                    )
                } else {
                    CartScreen(s, viewModel::onEvent, Modifier.padding(padding))
                }
            }
        }
    }
}

@Composable
private fun SummaryLine(label: String, value: String) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
fun CartScreen(
    state: CartUiState.Success,
    onEvent: (CartEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    val cart = state.cart
    Column(
        modifier
            .fillMaxSize()
            .semantics { contentDescription = "Cart" },
    ) {
        if (state.validation != null && !state.validation.valid) {
            Text(
                "Sepetinizdeki bazı ürünlerde sorun var. Güncel fiyat ve stok bilgilerini kontrol edin.",
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(horizontal = FurkanSpacing.md, vertical = FurkanSpacing.sm),
            )
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(FurkanSpacing.md),
            verticalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
        ) {
            items(cart.items, key = { it.productId }) { item ->
                CartLineItem(item = item, onEvent = onEvent)
            }
        }
    }
}

@Composable
private fun CartLineItem(
    item: CartItem,
    onEvent: (CartEvent) -> Unit,
) {
    FurkanSurfaceCard {
        Row(verticalAlignment = Alignment.Top) {
            FurkanNetworkImage(
                url = item.imageUrl,
                contentDescription = item.name,
                modifier = Modifier
                    .size(80.dp)
                    .clip(MaterialTheme.shapes.small),
            )
            Spacer(Modifier.width(FurkanSpacing.sm))
            Column(Modifier.weight(1f)) {
                Text(
                    item.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                )
                Text(
                    "SKU ${item.sku}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(FurkanSpacing.xxs))
                item.unitPrice?.let { FurkanPrice(it) }
                if (!item.available) {
                    Text(
                        "Stok yetersiz",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                Spacer(Modifier.height(FurkanSpacing.sm))
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    FurkanQtyStepper(
                        quantity = item.quantity,
                        onDecrement = { onEvent(CartEvent.UpdateQty(item.productId, item.quantity - 1)) },
                        onIncrement = { onEvent(CartEvent.UpdateQty(item.productId, item.quantity + 1)) },
                    )
                    TextButton(onClick = { onEvent(CartEvent.Remove(item.productId)) }) {
                        Text("Sil", color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }
}
