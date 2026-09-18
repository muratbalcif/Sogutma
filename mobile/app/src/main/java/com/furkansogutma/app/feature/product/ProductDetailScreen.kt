package com.furkansogutma.feature.product

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.core.designsystem.components.FurkanBadge
import com.furkansogutma.core.designsystem.components.FurkanButton
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanFavoriteIcon
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.components.FurkanNetworkImage
import com.furkansogutma.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.core.designsystem.components.FurkanPrice
import com.furkansogutma.core.designsystem.components.FurkanProductCard
import com.furkansogutma.core.designsystem.components.FurkanQtyStepper
import com.furkansogutma.core.designsystem.components.FurkanStickyBottomBar
import com.furkansogutma.core.designsystem.components.FurkanTopBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing

@Composable
fun ProductDetailRoute(
    onBack: () -> Unit = {},
    onRelatedProductClick: (String) -> Unit = {},
    viewModel: ProductDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val related by viewModel.relatedState.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(Unit) { viewModel.messages.collect { snackbar.showSnackbar(it) } }
    Scaffold(
        topBar = {
            FurkanTopBar(
                title = "Ürün",
                onBack = onBack,
                actions = {
                    val success = state as? ProductDetailUiState.Success
                    if (success != null) {
                        FurkanFavoriteIcon(
                            isFavorite = success.isFavorite,
                            onClick = { viewModel.onEvent(ProductDetailEvent.ToggleFavorite) },
                        )
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            val success = state as? ProductDetailUiState.Success
            if (success != null) {
                FurkanStickyBottomBar {
                    if (success.product.stockAvailable) {
                        FurkanButton("Sepete Ekle", Modifier.fillMaxWidth()) {
                            viewModel.onEvent(ProductDetailEvent.AddToCart)
                        }
                    } else {
                        FurkanButton("Stoğa Gelince Haber Ver", Modifier.fillMaxWidth()) {
                            viewModel.onEvent(ProductDetailEvent.CreateAlert)
                        }
                    }
                }
            }
        },
    ) { padding ->
        when (val s = state) {
            ProductDetailUiState.Loading -> FurkanLoading(Modifier.padding(padding))
            is ProductDetailUiState.Error -> FurkanError(s.message, Modifier.padding(padding)) {
                viewModel.onEvent(ProductDetailEvent.Retry)
            }
            is ProductDetailUiState.Success -> ProductDetailScreen(
                state = s,
                related = related,
                onEvent = viewModel::onEvent,
                onRelatedProductClick = onRelatedProductClick,
                modifier = Modifier.padding(padding),
            )
        }
    }
}

@Composable
fun ProductDetailScreen(
    state: ProductDetailUiState.Success,
    related: RelatedProductsUiState = RelatedProductsUiState.Loading,
    onEvent: (ProductDetailEvent) -> Unit,
    onRelatedProductClick: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val product = state.product
    var tab by remember { mutableIntStateOf(0) }
    val images = product.images.ifEmpty { emptyList() }
    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .semantics { contentDescription = "Product detail" },
    ) {
        if (images.isNotEmpty()) {
            val pager = rememberPagerState { images.size }
            HorizontalPager(state = pager) { page ->
                FurkanNetworkImage(
                    url = images[page].url,
                    contentDescription = "${product.name} görseli ${page + 1}",
                    modifier = Modifier.fillMaxWidth().aspectRatio(1f),
                )
            }
        } else {
            FurkanNetworkImage(null, product.name, Modifier.fillMaxWidth().aspectRatio(1f))
        }
        Column(Modifier.padding(FurkanSpacing.md)) {
            Text(product.brandName, style = MaterialTheme.typography.labelLarge)
            Text(product.name, style = MaterialTheme.typography.headlineLarge)
            Text("SKU: ${product.sku}", color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (product.onCampaign) FurkanBadge("Kampanya")
            if (product.price != null) {
                FurkanPrice(product.price!!.amount, product.compareAtPrice?.amount)
            }
            val stockText = when {
                !product.stockAvailable -> "Stokta yok"
                product.stockQuantity in 1..5 -> "Son birkaç ürün"
                else -> "Stokta"
            }
            Text(stockText)
            Spacer(Modifier.height(FurkanSpacing.md))
            FurkanQtyStepper(
                quantity = state.quantity,
                onDecrement = { onEvent(ProductDetailEvent.Decrement) },
                onIncrement = { onEvent(ProductDetailEvent.Increment) },
            )
            Spacer(Modifier.height(FurkanSpacing.md))
            val tabs = listOf("Açıklama", "Teknik", "Uyumluluk")
            TabRow(selectedTabIndex = tab) {
                tabs.forEachIndexed { index, title ->
                    Tab(selected = tab == index, onClick = { tab = index }, text = { Text(title) })
                }
            }
            Spacer(Modifier.height(FurkanSpacing.sm))
            when (tab) {
                0 -> Text(product.description.orEmpty().ifBlank { "Açıklama bulunmuyor." })
                1 -> if (product.attributes.isEmpty()) Text("Teknik özellik bulunmuyor.")
                else product.attributes.forEach { Text("${it.name}: ${it.value}") }
                else -> if (product.compatibility.isEmpty()) Text("Uyumluluk bilgisi yok.")
                else product.compatibility.forEach { Text("${it.manufacturer} ${it.model}") }
            }
            Spacer(Modifier.height(FurkanSpacing.lg))
            Text(
                "İlgili ürünler",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(FurkanSpacing.sm))
            when (related) {
                RelatedProductsUiState.Loading -> FurkanLoading(Modifier.height(120.dp))
                RelatedProductsUiState.Empty -> Text(
                    "İlgili ürün bulunmuyor.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                is RelatedProductsUiState.Error -> Column {
                    Text(related.message, color = MaterialTheme.colorScheme.error)
                    FurkanOutlinedButton("Tekrar dene") {
                        onEvent(ProductDetailEvent.RetryRelated)
                    }
                }
                is RelatedProductsUiState.Success -> LazyRow(
                    contentPadding = PaddingValues(vertical = FurkanSpacing.xs),
                    horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
                ) {
                    items(related.products, key = { it.id }) { item ->
                        FurkanProductCard(
                            name = item.name,
                            brand = item.brandName,
                            imageUrl = item.images.firstOrNull()?.url,
                            price = item.price?.amount,
                            compareAt = item.compareAtPrice?.amount,
                            onCampaign = item.onCampaign,
                            sku = item.sku,
                            onClick = { onRelatedProductClick(item.slug) },
                            modifier = Modifier.width(188.dp),
                        )
                    }
                }
            }
            Spacer(Modifier.height(FurkanSpacing.xxl))
        }
    }
}
