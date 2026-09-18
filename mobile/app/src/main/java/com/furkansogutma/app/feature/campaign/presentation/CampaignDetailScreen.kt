package com.furkansogutma.app.feature.campaign.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.app.core.designsystem.components.FurkanBadge
import com.furkansogutma.app.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.app.core.designsystem.components.FurkanError
import com.furkansogutma.app.core.designsystem.components.FurkanLoading
import com.furkansogutma.app.core.designsystem.components.FurkanTopBar
import com.furkansogutma.app.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.app.core.designsystem.theme.White
import com.furkansogutma.app.feature.product.domain.model.Campaign
import com.furkansogutma.app.feature.product.domain.model.CampaignProduct

@Composable
fun CampaignDetailRoute(
    onProductClick: (String) -> Unit,
    onBack: () -> Unit,
    viewModel: CampaignDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar(title = "Kampanya", onBack = onBack)
        when (val s = state) {
            CampaignDetailUiState.Loading -> FurkanLoading()
            is CampaignDetailUiState.Error -> FurkanError(s.message, onRetry = viewModel::retry)
            is CampaignDetailUiState.Success -> CampaignDetailScreen(
                campaign = s.campaign,
                products = s.products,
                onProductClick = onProductClick,
            )
        }
    }
}

@Composable
fun CampaignDetailScreen(
    campaign: Campaign,
    products: List<CampaignProduct>,
    onProductClick: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .semantics { contentDescription = "Campaign detail" },
        contentPadding = PaddingValues(FurkanSpacing.md),
        verticalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
    ) {
        item {
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(White, MaterialTheme.shapes.medium)
                    .padding(FurkanSpacing.md),
            ) {
                Text(
                    campaign.name,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                if (!campaign.description.isNullOrBlank()) {
                    Text(
                        campaign.description.orEmpty(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = FurkanSpacing.xs),
                    )
                }
                when (campaign.status) {
                    "EXPIRED", "INACTIVE" -> {
                        Text(
                            "Bu kampanya sona ermiştir.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(top = FurkanSpacing.sm),
                        )
                    }
                    else -> Unit
                }
            }
        }
        if (products.isEmpty()) {
            item {
                FurkanEmptyState(
                    title = "Ürün bulunamadı",
                    message = "Bu kampanyaya henüz ürün eklenmemiş.",
                    icon = Icons.Outlined.Inventory2,
                )
            }
        } else {
            items(
                products.filter { it.slug.isNotBlank() },
                key = { it.id },
            ) { product ->
                CampaignProductRow(product, onProductClick)
            }
        }
    }
}

@Composable
private fun CampaignProductRow(
    product: CampaignProduct,
    onProductClick: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(White, MaterialTheme.shapes.medium)
            .clickable { onProductClick(product.slug) }
            .padding(FurkanSpacing.md),
    ) {
        Text(
            product.name.ifBlank { product.sku },
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Medium,
        )
        Text(
            "SKU: ${product.sku}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        FurkanBadge(
            text = "Kampanya",
            modifier = Modifier.padding(top = FurkanSpacing.xs),
        )
        product.specialPrice?.let {
            Text(
                "Özel fiyat: $it",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = FurkanSpacing.xxs),
            )
        }
        product.discountPercentage?.let {
            Text(
                "%$it indirim",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = FurkanSpacing.xxs),
            )
        }
        product.discountAmount?.let {
            Text(
                "$it TL indirim",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = FurkanSpacing.xxs),
            )
        }
    }
}
