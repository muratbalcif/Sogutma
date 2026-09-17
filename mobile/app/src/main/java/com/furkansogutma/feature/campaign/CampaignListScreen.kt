package com.furkansogutma.feature.campaign

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
import androidx.compose.material.icons.outlined.LocalOffer
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
import com.furkansogutma.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.components.FurkanTopBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.core.designsystem.theme.White
import com.furkansogutma.domain.product.Campaign

@Composable
fun CampaignListRoute(
    onCampaignClick: (String) -> Unit,
    onBack: (() -> Unit)? = null,
    viewModel: CampaignListViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar(title = "Kampanyalar", onBack = onBack)
        when {
            state.isLoading -> FurkanLoading()
            state.error != null -> FurkanError(state.error!!, onRetry = viewModel::retry)
            state.campaigns.isEmpty() -> FurkanEmptyState(
                title = "Şu an aktif kampanya yok",
                message = "Yeni kampanyalar eklendiğinde burada listelenir.",
                icon = Icons.Outlined.LocalOffer,
            )
            else -> CampaignListScreen(state.campaigns, onCampaignClick)
        }
    }
}

@Composable
fun CampaignListScreen(
    campaigns: List<Campaign>,
    onCampaignClick: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .semantics { contentDescription = "Campaign list" },
        contentPadding = PaddingValues(FurkanSpacing.md),
        verticalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
    ) {
        items(campaigns, key = { it.id }) { campaign ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(White, MaterialTheme.shapes.medium)
                    .clickable { onCampaignClick(campaign.slug) }
                    .padding(FurkanSpacing.md),
            ) {
                Text(
                    campaign.type,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    campaign.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                )
                if (!campaign.description.isNullOrBlank()) {
                    Text(
                        campaign.description.orEmpty(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = FurkanSpacing.xxs),
                    )
                }
            }
        }
    }
}
