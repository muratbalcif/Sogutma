package com.furkansogutma.app.feature.home.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.app.core.designsystem.components.FurkanError
import com.furkansogutma.app.core.designsystem.components.FurkanHomeSkeleton
import com.furkansogutma.app.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.app.feature.home.domain.usecase.HomeCatalog

private val ScreenPadding = 20.dp
private val SectionGap = 28.dp

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
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .semantics { contentDescription = "Home" },
        contentPadding = PaddingValues(
            start = ScreenPadding,
            end = ScreenPadding,
            top = FurkanSpacing.md,
            bottom = FurkanSpacing.xl,
        ),
        verticalArrangement = Arrangement.spacedBy(SectionGap),
    ) {
        item {
            HomeHeader(
                greeting = greeting,
                cartCount = cartCount,
                onCartClick = onCartClick,
                onSearchClick = onSearchClick,
            )
        }
        item {
            HomeHero(
                banners = catalog.banners,
                onBrowse = { onSeeAllProducts(null) },
                onProductClick = onProductClick,
                onCategoryClick = onCategoryClick,
                onCampaigns = onSeeAllCampaigns,
            )
        }
        item {
            HomeCategorySection(
                categories = catalog.categories,
                onCategoryClick = onCategoryClick,
                onSeeAll = onSeeAllCategories,
            )
        }
        item {
            HomeProductSection(
                title = "Günün Ürünleri",
                products = catalog.featured,
                onProductClick = onProductClick,
                onSeeAll = { onSeeAllProducts(null) },
            )
        }
        item {
            HomeCampaignSection(
                products = catalog.campaigns,
                onProductClick = onProductClick,
                onSeeAll = onSeeAllCampaigns,
            )
        }
        item {
            HomeProductSection(
                title = "En Çok Satanlar",
                products = catalog.bestSelling,
                onProductClick = onProductClick,
                onSeeAll = { onSeeAllProducts(null) },
            )
        }
        if (catalog.brands.isNotEmpty()) {
            item {
                HomeBrandSection(brands = catalog.brands)
            }
        }
        if (catalog.sectionErrors.isNotEmpty()) {
            item {
                Text(
                    catalog.sectionErrors.joinToString("\n"),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}
