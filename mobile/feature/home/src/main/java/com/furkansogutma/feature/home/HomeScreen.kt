package com.furkansogutma.feature.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.components.FurkanProductCard
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.domain.product.Product

@Composable
fun HomeRoute(
    onProductClick: (String) -> Unit,
    onCategoryClick: (String) -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    when (val s = state) {
        HomeUiState.Loading -> FurkanLoading()
        is HomeUiState.Error -> FurkanError(s.message, onRetry = viewModel::load)
        is HomeUiState.Success -> HomeScreen(s.catalog, onProductClick, onCategoryClick)
    }
}

@Composable
fun HomeScreen(
    catalog: com.furkansogutma.domain.product.HomeCatalog,
    onProductClick: (String) -> Unit,
    onCategoryClick: (String) -> Unit,
) {
    LazyColumn(
        Modifier
            .fillMaxSize()
            .semantics { contentDescription = "Home" },
        contentPadding = PaddingValues(FurkanSpacing.md),
        verticalArrangement = Arrangement.spacedBy(FurkanSpacing.lg),
    ) {
        item {
            Text("FurkanSoğutma", style = MaterialTheme.typography.headlineLarge)
        }
        if (catalog.banners.isNotEmpty()) {
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
                    items(catalog.banners, key = { it.id }) { banner ->
                        AsyncImage(
                            model = banner.imageUrl,
                            contentDescription = banner.title,
                            modifier = Modifier
                                .width(300.dp)
                                .height(140.dp),
                            contentScale = ContentScale.Crop,
                        )
                    }
                }
            }
        }
        item { SectionTitle("Kategoriler") }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
                items(catalog.categories, key = { it.id }) { category ->
                    Text(
                        category.name,
                        modifier = Modifier
                            .clickable { onCategoryClick(category.slug) }
                            .padding(FurkanSpacing.sm),
                        style = MaterialTheme.typography.titleMedium,
                    )
                }
            }
        }
        item { ProductRow("Öne çıkanlar", catalog.featured, onProductClick) }
        item { ProductRow("Kampanyalar", catalog.campaigns, onProductClick) }
        item { ProductRow("Çok satanlar", catalog.bestSelling, onProductClick) }
        if (catalog.brands.isNotEmpty()) {
            item { SectionTitle("Markalar") }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
                    items(catalog.brands, key = { it.id }) { brand ->
                        Text(brand.name, modifier = Modifier.padding(FurkanSpacing.sm))
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(title: String) {
    Text(title, style = MaterialTheme.typography.titleLarge)
}

@Composable
private fun ProductRow(title: String, products: List<Product>, onProductClick: (String) -> Unit) {
    Column {
        SectionTitle(title)
        Spacer(Modifier.height(FurkanSpacing.sm))
        if (products.isEmpty()) {
            Text("Henüz ürün yok", color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
                items(products, key = { it.id }) { product ->
                    FurkanProductCard(
                        name = product.name,
                        brand = product.brandName,
                        imageUrl = product.images.firstOrNull()?.url,
                        price = product.price?.amount,
                        compareAt = product.compareAtPrice?.amount,
                        onCampaign = product.onCampaign,
                        onClick = { onProductClick(product.slug) },
                        modifier = Modifier.width(180.dp),
                    )
                }
            }
        }
    }
}
