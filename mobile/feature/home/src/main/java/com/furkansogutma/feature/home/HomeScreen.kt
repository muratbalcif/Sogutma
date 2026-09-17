package com.furkansogutma.feature.home

import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.core.designsystem.components.FurkanCartIconButton
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanHomeSkeleton
import com.furkansogutma.core.designsystem.components.FurkanNetworkImage
import com.furkansogutma.core.designsystem.components.FurkanProductCard
import com.furkansogutma.core.designsystem.components.FurkanSearchBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.domain.product.HomeCatalog
import com.furkansogutma.domain.product.Product

@Composable
fun HomeRoute(
    onProductClick: (String) -> Unit,
    onCategoryClick: (String) -> Unit,
    onSearchClick: () -> Unit,
    onCartClick: () -> Unit,
    onSeeAllProducts: (String?) -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val cartCount by viewModel.cartCount.collectAsStateWithLifecycle()

    when (val s = state) {
        HomeUiState.Loading -> FurkanHomeSkeleton()
        is HomeUiState.Error -> FurkanError(s.message, onRetry = viewModel::load)
        is HomeUiState.Success -> HomeScreen(
            greeting = s.greeting,
            catalog = s.catalog,
            cartCount = cartCount,
            onProductClick = onProductClick,
            onCategoryClick = onCategoryClick,
            onSearchClick = onSearchClick,
            onCartClick = onCartClick,
            onSeeAllProducts = onSeeAllProducts,
        )
    }
}

@Composable
fun HomeScreen(
    greeting: String,
    catalog: HomeCatalog,
    cartCount: Int,
    onProductClick: (String) -> Unit,
    onCategoryClick: (String) -> Unit,
    onSearchClick: () -> Unit,
    onCartClick: () -> Unit,
    onSeeAllProducts: (String?) -> Unit,
) {
    LazyColumn(
        Modifier.fillMaxSize().semantics { contentDescription = "Home" },
        contentPadding = PaddingValues(bottom = FurkanSpacing.xl),
        verticalArrangement = Arrangement.spacedBy(FurkanSpacing.lg),
    ) {
        item {
            Column(Modifier.padding(horizontal = FurkanSpacing.md, vertical = FurkanSpacing.sm)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(greeting, style = MaterialTheme.typography.titleLarge)
                        Text("FurkanSoğutma", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    FurkanCartIconButton(count = cartCount, onClick = onCartClick)
                }
                Spacer(Modifier.height(FurkanSpacing.sm))
                FurkanSearchBar(query = "", onQueryChange = { onSearchClick() }, modifier = Modifier.clickable { onSearchClick() })
            }
        }
        if (catalog.banners.isNotEmpty()) {
            item {
                val pager = rememberPagerState { catalog.banners.size }
                HorizontalPager(
                    state = pager,
                    contentPadding = PaddingValues(horizontal = FurkanSpacing.md),
                    pageSpacing = FurkanSpacing.sm,
                ) { page ->
                    val banner = catalog.banners[page]
                    FurkanNetworkImage(
                        url = banner.imageUrl,
                        contentDescription = banner.title,
                        modifier = Modifier.fillMaxWidth().height(160.dp).clip(MaterialTheme.shapes.medium),
                    )
                }
            }
        }
        item { SectionHeader("Kategoriler", onSeeAll = { onSeeAllProducts(null) }) }
        item {
            LazyRow(
                contentPadding = PaddingValues(horizontal = FurkanSpacing.md),
                horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.md),
            ) {
                items(catalog.categories, key = { it.id }) { category ->
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .width(76.dp)
                            .clickable { onCategoryClick(category.slug) },
                    ) {
                        FurkanNetworkImage(
                            url = null,
                            contentDescription = category.name,
                            modifier = Modifier.size(64.dp).clip(CircleShape),
                        )
                        Text(category.name, style = MaterialTheme.typography.labelLarge, maxLines = 2)
                    }
                }
            }
        }
        item { ProductSection("Öne Çıkanlar", catalog.featured, onProductClick) { onSeeAllProducts(null) } }
        item { ProductSection("Kampanyalar", catalog.campaigns, onProductClick) { onSeeAllProducts(null) } }
        item { ProductSection("Çok Satanlar", catalog.bestSelling, onProductClick) { onSeeAllProducts(null) } }
        if (catalog.brands.isNotEmpty()) {
            item { SectionHeader("Markalar") }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = FurkanSpacing.md), horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
                    items(catalog.brands, key = { it.id }) { brand ->
                        Text(brand.name, modifier = Modifier.padding(FurkanSpacing.sm), style = MaterialTheme.typography.titleMedium)
                    }
                }
            }
        }
        if (catalog.sectionErrors.isNotEmpty()) {
            item {
                Text(
                    catalog.sectionErrors.joinToString("\n"),
                    modifier = Modifier.padding(FurkanSpacing.md),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, onSeeAll: (() -> Unit)? = null) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = FurkanSpacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
        if (onSeeAll != null) TextButton(onClick = onSeeAll) { Text("Tümünü Gör") }
    }
}

@Composable
private fun ProductSection(
    title: String,
    products: List<Product>,
    onProductClick: (String) -> Unit,
    onSeeAll: () -> Unit,
) {
    Column {
        SectionHeader(title, onSeeAll)
        if (products.isEmpty()) {
            Text("Henüz ürün yok", modifier = Modifier.padding(horizontal = FurkanSpacing.md), color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            LazyRow(
                contentPadding = PaddingValues(horizontal = FurkanSpacing.md),
                horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
            ) {
                items(products, key = { it.id }) { product ->
                    FurkanProductCard(
                        name = product.name,
                        brand = product.brandName,
                        imageUrl = product.images.firstOrNull()?.url,
                        price = product.price?.amount,
                        compareAt = product.compareAtPrice?.amount,
                        onCampaign = product.onCampaign,
                        stockLabel = if (product.stockAvailable) "Stokta" else "Stok yok",
                        onClick = { onProductClick(product.slug) },
                        modifier = Modifier.width(180.dp),
                    )
                }
            }
        }
    }
}
