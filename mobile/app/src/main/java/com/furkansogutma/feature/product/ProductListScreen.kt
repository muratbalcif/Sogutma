package com.furkansogutma.feature.product

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.components.FurkanProductCard
import com.furkansogutma.core.designsystem.theme.FurkanSpacing

@Composable
fun ProductListRoute(
    onProductClick: (String) -> Unit,
    viewModel: ProductListViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    when {
        state.isLoading && state.products.isEmpty() -> FurkanLoading()
        state.error != null && state.products.isEmpty() ->
            FurkanError(state.error!!, onRetry = { viewModel.onEvent(ProductListEvent.Retry) })
        state.products.isEmpty() -> FurkanEmptyState("Ürün yok", "Filtrelerinizi değiştirmeyi deneyin")
        else -> ProductListScreen(state, viewModel::onEvent, onProductClick)
    }
}

@Composable
fun ProductListScreen(
    state: ProductListUiState,
    onEvent: (ProductListEvent) -> Unit,
    onProductClick: (String) -> Unit,
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = Modifier
            .fillMaxSize()
            .semantics { contentDescription = "Product list" },
        contentPadding = PaddingValues(FurkanSpacing.md),
        horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
        verticalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
    ) {
        item {
            TextButton(onClick = { onEvent(ProductListEvent.SortChanged("price_asc")) }) {
                Text("Fiyat ↑")
            }
        }
        items(state.products, key = { it.id }) { product ->
            FurkanProductCard(
                name = product.name,
                brand = product.brandName,
                imageUrl = product.images.firstOrNull()?.url,
                price = product.price?.amount,
                compareAt = product.compareAtPrice?.amount,
                onCampaign = product.onCampaign,
                onClick = { onProductClick(product.slug) },
            )
        }
        if (state.page < state.totalPages) {
            item {
                TextButton(onClick = { onEvent(ProductListEvent.NextPage) }) { Text("Daha fazla") }
            }
        }
    }
}
