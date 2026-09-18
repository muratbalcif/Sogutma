package com.furkansogutma.app.feature.product.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.outlined.SearchOff
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.app.core.designsystem.components.FurkanButton
import com.furkansogutma.app.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.app.core.designsystem.components.FurkanError
import com.furkansogutma.app.core.designsystem.components.FurkanLoading
import com.furkansogutma.app.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.app.core.designsystem.components.FurkanProductCard
import com.furkansogutma.app.core.designsystem.components.FurkanSearchBar
import com.furkansogutma.app.core.designsystem.components.FurkanTextField
import com.furkansogutma.app.core.designsystem.components.FurkanToolbarChip
import com.furkansogutma.app.core.designsystem.components.FurkanTopBar
import com.furkansogutma.app.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.app.core.designsystem.theme.White

private val sortOptions = listOf(
    "recommended" to "Önerilen",
    "newest" to "Yeni ürünler",
    "price_asc" to "En düşük fiyat",
    "price_desc" to "En yüksek fiyat",
    "best_selling" to "Çok satanlar",
)

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
            else -> ProductListScreen(state, viewModel::onEvent, onProductClick)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductListScreen(
    state: ProductListUiState,
    onEvent: (ProductListEvent) -> Unit,
    onProductClick: (String) -> Unit,
) {
    val filterCount = state.filters.activeCount()
    val sortTitle = sortOptions.firstOrNull { it.first == state.sort }?.second ?: "Sırala"
    val chips = buildFilterChips(state)

    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxWidth()
                .background(White)
                .padding(horizontal = FurkanSpacing.md, vertical = FurkanSpacing.xs),
            verticalArrangement = Arrangement.spacedBy(FurkanSpacing.xs),
        ) {
            FurkanSearchBar(
                query = state.searchDraft,
                onQueryChange = { onEvent(ProductListEvent.SearchDraftChanged(it)) },
                onSearch = { onEvent(ProductListEvent.ApplySearch) },
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.xs)) {
                FurkanToolbarChip(
                    text = if (filterCount > 0) "Filtreler ($filterCount)" else "Filtreler",
                    leadingIcon = Icons.Default.FilterList,
                    onClick = { onEvent(ProductListEvent.OpenFilters) },
                    modifier = Modifier.weight(1f),
                )
                FurkanToolbarChip(
                    text = "Sırala: ${sortTitle.replace(" ürünler", "")}",
                    leadingIcon = Icons.AutoMirrored.Filled.Sort,
                    onClick = { onEvent(ProductListEvent.OpenSort) },
                    modifier = Modifier.weight(1f),
                )
            }
        }

        if (chips.isNotEmpty()) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(White)
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = FurkanSpacing.md, vertical = FurkanSpacing.xs),
                horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.xs),
            ) {
                chips.forEach { chip ->
                    FilterChip(
                        selected = true,
                        onClick = { onEvent(ProductListEvent.RemoveFilter(chip.key)) },
                        label = { Text(chip.label) },
                        trailingIcon = {
                            Icon(Icons.Default.Close, contentDescription = "Kaldır")
                        },
                    )
                }
            }
        }

        Row(
            Modifier
                .fillMaxWidth()
                .background(White)
                .padding(horizontal = FurkanSpacing.md, vertical = FurkanSpacing.xs),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Ürünler",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                "${state.total} ürün",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.6f))

        if (state.products.isEmpty() && !state.isLoading) {
            FurkanEmptyState(
                title = "Aranan kriterlere uygun ürün bulunamadı",
                message = "",
                icon = Icons.Outlined.SearchOff,
            )
        } else {
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

    if (state.showFiltersSheet) {
        ModalBottomSheet(
            onDismissRequest = { onEvent(ProductListEvent.CloseFilters) },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        ) {
            val draft = state.draftFilters
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = FurkanSpacing.md)
                    .verticalScroll(rememberScrollState()),
            ) {
                Text(
                    "Filtreler",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(FurkanSpacing.md))

                Text("Kategori", style = MaterialTheme.typography.labelLarge)
                Spacer(Modifier.height(FurkanSpacing.xs))
                FilterDropdown(
                    selectedLabel = state.categories
                        .firstOrNull { it.slug == draft.category }
                        ?.name
                        ?: "Tümü",
                    options = listOf(null to "Tümü") +
                        state.categories.map { it.slug to it.name },
                    onSelect = { slug ->
                        onEvent(
                            ProductListEvent.DraftFiltersChanged(draft.copy(category = slug)),
                        )
                    },
                )

                Spacer(Modifier.height(FurkanSpacing.md))
                Text("Marka", style = MaterialTheme.typography.labelLarge)
                Spacer(Modifier.height(FurkanSpacing.xs))
                FilterDropdown(
                    selectedLabel = state.brands
                        .firstOrNull { it.slug == draft.brand }
                        ?.name
                        ?: "Tümü",
                    options = listOf(null to "Tümü") +
                        state.brands.map { it.slug to it.name },
                    onSelect = { slug ->
                        onEvent(
                            ProductListEvent.DraftFiltersChanged(draft.copy(brand = slug)),
                        )
                    },
                )

                Spacer(Modifier.height(FurkanSpacing.md))
                Row(horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
                    FurkanTextField(
                        value = draft.minPrice,
                        onValueChange = {
                            onEvent(
                                ProductListEvent.DraftFiltersChanged(draft.copy(minPrice = it)),
                            )
                        },
                        label = "Min fiyat",
                        modifier = Modifier.weight(1f),
                    )
                    FurkanTextField(
                        value = draft.maxPrice,
                        onValueChange = {
                            onEvent(
                                ProductListEvent.DraftFiltersChanged(draft.copy(maxPrice = it)),
                            )
                        },
                        label = "Max fiyat",
                        modifier = Modifier.weight(1f),
                    )
                }

                Spacer(Modifier.height(FurkanSpacing.md))
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Stokta olanlar")
                    Switch(
                        checked = draft.inStock,
                        onCheckedChange = {
                            onEvent(
                                ProductListEvent.DraftFiltersChanged(draft.copy(inStock = it)),
                            )
                        },
                    )
                }
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Kampanyalı")
                    Switch(
                        checked = draft.onCampaign,
                        onCheckedChange = {
                            onEvent(
                                ProductListEvent.DraftFiltersChanged(draft.copy(onCampaign = it)),
                            )
                        },
                    )
                }

                Spacer(Modifier.height(FurkanSpacing.lg))
                Row(horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
                    FurkanOutlinedButton(
                        text = "Temizle",
                        onClick = { onEvent(ProductListEvent.ClearFilters) },
                        modifier = Modifier.weight(1f),
                    )
                    FurkanButton(
                        text = "Ürünleri Göster",
                        onClick = { onEvent(ProductListEvent.ApplyFilters) },
                        modifier = Modifier.weight(1f),
                    )
                }
                Spacer(Modifier.height(FurkanSpacing.xl))
            }
        }
    }

    if (state.showSortSheet) {
        ModalBottomSheet(
            onDismissRequest = { onEvent(ProductListEvent.CloseSort) },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        ) {
            Column(
                Modifier.padding(horizontal = FurkanSpacing.md, vertical = FurkanSpacing.sm),
            ) {
                Text(
                    "Sıralama",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(FurkanSpacing.md))
                sortOptions.forEach { (value, label) ->
                    FilterChoiceChip(
                        selected = state.sort == value,
                        label = label,
                        onClick = { onEvent(ProductListEvent.SortChanged(value)) },
                    )
                }
                Spacer(Modifier.height(FurkanSpacing.xl))
            }
        }
    }
}

@Composable
private fun FilterDropdown(
    selectedLabel: String,
    options: List<Pair<String?, String>>,
    onSelect: (String?) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = Modifier.fillMaxWidth(),
    ) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                .fillMaxWidth(),
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            options.forEach { (value, label) ->
                DropdownMenuItem(
                    text = { Text(label) },
                    onClick = {
                        onSelect(value)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun FilterChoiceChip(
    selected: Boolean,
    label: String,
    onClick: () -> Unit,
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
    )
}

private data class Chip(val key: String, val label: String)

private fun buildFilterChips(state: ProductListUiState): List<Chip> {
    val filters = state.filters
    val chips = mutableListOf<Chip>()
    if (state.search.isNotBlank()) chips += Chip("search", "“${state.search}”")
    filters.category?.let { slug ->
        val name = state.categories.firstOrNull { it.slug == slug }?.name ?: slug
        chips += Chip("category", name)
    }
    filters.brand?.let { slug ->
        val name = state.brands.firstOrNull { it.slug == slug }?.name ?: slug
        chips += Chip("brand", name)
    }
    if (filters.minPrice.isNotBlank()) chips += Chip("minPrice", "Min ${filters.minPrice}")
    if (filters.maxPrice.isNotBlank()) chips += Chip("maxPrice", "Max ${filters.maxPrice}")
    if (filters.inStock) chips += Chip("inStock", "Stokta")
    if (filters.onCampaign) chips += Chip("onCampaign", "Kampanyalı")
    return chips
}
