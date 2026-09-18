package com.furkansogutma.app.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.core.designsystem.components.FurkanCartIconButton
import com.furkansogutma.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanHomeSkeleton
import com.furkansogutma.core.designsystem.components.FurkanNetworkImage
import com.furkansogutma.core.designsystem.components.FurkanProductCard
import com.furkansogutma.core.designsystem.components.FurkanSearchBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.core.designsystem.theme.PrimaryLight
import com.furkansogutma.core.designsystem.theme.White
import com.furkansogutma.domain.category.Category
import com.furkansogutma.domain.product.Brand
import com.furkansogutma.domain.product.HomeCatalog
import com.furkansogutma.domain.product.Product

@Composable
fun HomeRoute(
    onProductClick: (String) -> Unit,
    onCategoryClick: (String) -> Unit,
    onSearchClick: () -> Unit,
    onCartClick: () -> Unit,
    onSeeAllProducts: (String?) -> Unit,
    onSeeAllCategories: () -> Unit = {},
    onSeeAllCampaigns: () -> Unit = {},
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
            onSeeAllCategories = onSeeAllCategories,
            onSeeAllCampaigns = onSeeAllCampaigns,
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
    onSeeAllCategories: () -> Unit = {},
    onSeeAllCampaigns: () -> Unit = {},
) {
    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .semantics { contentDescription = "Home" },
        contentPadding = PaddingValues(bottom = FurkanSpacing.xl),
        verticalArrangement = Arrangement.spacedBy(FurkanSpacing.lg),
    ) {
        item {
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(White)
                    .padding(horizontal = FurkanSpacing.md, vertical = FurkanSpacing.md),
            ) {
                Row(
                    Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            "FurkanSoğutma",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Spacer(Modifier.height(FurkanSpacing.xxs))
                        Text(
                            greeting,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    FurkanCartIconButton(count = cartCount, onClick = onCartClick)
                }
                Spacer(Modifier.height(FurkanSpacing.md))
                FurkanSearchBar(
                    query = "",
                    onQueryChange = { onSearchClick() },
                    modifier = Modifier.clickable { onSearchClick() },
                )
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
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(168.dp)
                            .clip(MaterialTheme.shapes.large)
                            .shadow(4.dp, MaterialTheme.shapes.large, clip = false),
                    )
                }
            }
        }
        item {
            SectionHeader("Kategoriler", onSeeAll = onSeeAllCategories)
        }
        item {
            CategoryRow(
                categories = catalog.categories,
                onCategoryClick = onCategoryClick,
            )
        }
        item {
            ProductSection(
                title = "Günün Ürünleri",
                products = catalog.featured,
                onProductClick = onProductClick,
                onSeeAll = { onSeeAllProducts(null) },
            )
        }
        item {
            ProductSection(
                title = "Kampanyalar",
                products = catalog.campaigns,
                onProductClick = onProductClick,
                onSeeAll = onSeeAllCampaigns,
            )
        }
        item {
            ProductSection(
                title = "En Çok Satanlar",
                products = catalog.bestSelling,
                onProductClick = onProductClick,
                onSeeAll = { onSeeAllProducts(null) },
            )
        }
        if (catalog.brands.isNotEmpty()) {
            item { SectionHeader("Markalar") }
            item { BrandRow(catalog.brands) }
        }
        if (catalog.sectionErrors.isNotEmpty()) {
            item {
                Text(
                    catalog.sectionErrors.joinToString("\n"),
                    modifier = Modifier.padding(horizontal = FurkanSpacing.md),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun CategoryRow(
    categories: List<Category>,
    onCategoryClick: (String) -> Unit,
) {
    if (categories.isEmpty()) {
        FurkanEmptyState(
            title = "Kategori yok",
            message = "Kategoriler şu an listelenemiyor.",
            modifier = Modifier.height(160.dp),
        )
        return
    }
    LazyRow(
        contentPadding = PaddingValues(horizontal = FurkanSpacing.md),
        horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.md),
    ) {
        items(categories, key = { it.id }) { category ->
            val label = category.name.trim().ifBlank { category.slug }
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .width(84.dp)
                    .clickable { onCategoryClick(category.slug) },
            ) {
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .shadow(3.dp, CircleShape, clip = false)
                        .clip(CircleShape)
                        .background(White)
                        .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        Modifier
                            .size(60.dp)
                            .clip(CircleShape)
                            .background(PrimaryLight),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            label.take(1).uppercase(),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                Spacer(Modifier.height(FurkanSpacing.xs))
                Text(
                    label,
                    style = MaterialTheme.typography.labelMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

@Composable
private fun BrandRow(brands: List<Brand>) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = FurkanSpacing.md),
        horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
    ) {
        items(brands, key = { it.id }) { brand ->
            val label = brand.name.trim().ifBlank { brand.slug }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .height(48.dp)
                    .clip(MaterialTheme.shapes.medium)
                    .background(White)
                    .border(1.dp, MaterialTheme.colorScheme.outline, MaterialTheme.shapes.medium)
                    .padding(horizontal = FurkanSpacing.md),
            ) {
                if (!brand.logo.isNullOrBlank()) {
                    FurkanNetworkImage(
                        url = brand.logo,
                        contentDescription = label,
                        modifier = Modifier
                            .size(28.dp)
                            .clip(CircleShape),
                    )
                    Spacer(Modifier.width(FurkanSpacing.xs))
                }
                Text(
                    label,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, onSeeAll: (() -> Unit)? = null) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = FurkanSpacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
        if (onSeeAll != null) {
            TextButton(onClick = onSeeAll) {
                Text(
                    "Tümü",
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
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
            FurkanEmptyState(
                title = "Ürün yok",
                message = "Bu bölümde henüz ürün bulunmuyor.",
                modifier = Modifier.height(180.dp),
            )
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
                        sku = product.sku,
                        stockLabel = if (product.stockAvailable) null else "Stok yok",
                        onClick = { onProductClick(product.slug) },
                        modifier = Modifier.width(188.dp),
                    )
                }
            }
        }
    }
}
