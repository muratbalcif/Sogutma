package com.furkansogutma.app.feature.product

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.outlined.SearchOff
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
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
import com.furkansogutma.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.core.designsystem.components.FurkanProductCard
import com.furkansogutma.core.designsystem.components.FurkanToolbarChip
import com.furkansogutma.core.designsystem.components.FurkanTopBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.core.designsystem.theme.White

@Composable
fun ProductListRoute(
    onProductClick: (String) -> Unit,
    onBack: (() -> Unit)? = null,
    viewModel: ProductListViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar(title = "Ürün Listesi", onBack = onBack)
        when {
            state.isLoading && state.products.isEmpty() -> FurkanLoading()
            state.error != null && state.products.isEmpty() ->
                FurkanError(state.error!!, onRetry = { viewModel.onEvent(ProductListEvent.Retry) })
            state.products.isEmpty() -> FurkanEmptyState(
                title = "Aranan kriterlere uygun ürün bulunamadı",
                message = "",
                icon = Icons.Outlined.SearchOff,
            )
            else -> ProductListScreen(state, viewModel::onEvent, onProductClick)
        }
    }
}

@Composable
fun ProductListScreen(
    state: ProductListUiState,
    onEvent: (ProductListEvent) -> Unit,
    onProductClick: (String) -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(White)
                .padding(horizontal = FurkanSpacing.md, vertical = FurkanSpacing.xs),
            horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.xs),
        ) {
            FurkanToolbarChip(
                text = "Filtrele",
                leadingIcon = Icons.Default.FilterList,
                onClick = { /* filters sheet later */ },
                modifier = Modifier.weight(1f),
            )
            FurkanToolbarChip(
                text = "Sırala",
                leadingIcon = Icons.AutoMirrored.Filled.Sort,
                onClick = { onEvent(ProductListEvent.SortChanged("price_asc")) },
                modifier = Modifier.weight(1f),
            )
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.6f))

        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier
                .fillMaxSize()
                .semantics { contentDescription = "Product list" },
            contentPadding = PaddingValues(FurkanSpacing.md),
            horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
            verticalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
        ) {
            items(state.products, key = { it.id }) { product ->
                FurkanProductCard(
                    name = product.name,
                    brand = product.brandName,
                    imageUrl = product.images.firstOrNull()?.url,
                    price = product.price?.amount,
                    compareAt = product.compareAtPrice?.amount,
                    onCampaign = product.onCampaign,
                    sku = product.sku,
                    onClick = { onProductClick(product.slug) },
                )
            }
            if (state.page < state.totalPages) {
                item(span = { GridItemSpan(2) }) {
                    FurkanOutlinedButton(
                        text = "Daha fazla",
                        onClick = { onEvent(ProductListEvent.NextPage) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }
}
