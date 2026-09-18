package com.furkansogutma.app.feature.search.presentation

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.core.datastore.AppSettingsDataStore
import com.furkansogutma.app.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.app.core.designsystem.components.FurkanProductCard
import com.furkansogutma.app.core.designsystem.components.FurkanSearchBar
import com.furkansogutma.app.core.designsystem.components.FurkanSurfaceCard
import com.furkansogutma.app.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.app.core.designsystem.theme.White
import com.furkansogutma.app.feature.product.domain.model.Product
import com.furkansogutma.app.feature.search.domain.usecase.SearchProductsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val searchProducts: SearchProductsUseCase,
    private val settings: AppSettingsDataStore,
) : ViewModel() {
    private val _results = MutableStateFlow<List<Product>>(emptyList())
    val results = _results.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()
    private val _emptyQuery = MutableStateFlow(true)
    val emptyQuery = _emptyQuery.asStateFlow()
    val recent = settings.recentSearches
    private var job: Job? = null

    fun onQuery(q: String) {
        job?.cancel()
        _emptyQuery.value = q.isBlank()
        job = viewModelScope.launch {
            delay(400)
            if (q.isBlank()) {
                _results.value = emptyList()
                return@launch
            }
            settings.addRecentSearch(q)
            when (val result = searchProducts(q)) {
                is Result.Success -> {
                    _results.value = result.data.items
                    _error.value = null
                }
                is Result.Error -> _error.value = result.error.message
            }
        }
    }

    fun clearRecent() = viewModelScope.launch { settings.clearRecentSearches() }
    fun removeRecent(q: String) = viewModelScope.launch { settings.removeRecentSearch(q) }
}

@Composable
fun SearchRoute(
    onProductClick: (String) -> Unit,
    viewModel: SearchViewModel = hiltViewModel(),
) {
    var query by remember { mutableStateOf("") }
    val results by viewModel.results.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val emptyQuery by viewModel.emptyQuery.collectAsStateWithLifecycle()
    val recent by viewModel.recent.collectAsStateWithLifecycle(initialValue = emptyList())

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .background(White)
                .padding(FurkanSpacing.md),
        ) {
            Text(
                "Ara",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(FurkanSpacing.sm))
            FurkanSearchBar(
                query = query,
                onQueryChange = {
                    query = it
                    viewModel.onQuery(it)
                },
            )
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.6f))

        if (error != null) {
            Text(
                error!!,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(FurkanSpacing.md),
            )
        }
        if (emptyQuery) {
            Column(Modifier.padding(FurkanSpacing.md)) {
                Row(
                    Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Son aramalar",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    if (recent.isNotEmpty()) {
                        TextButton(onClick = viewModel::clearRecent) { Text("Temizle") }
                    }
                }
                if (recent.isEmpty()) {
                    Text(
                        "Henüz arama yapmadınız.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = FurkanSpacing.sm),
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(FurkanSpacing.xs)) {
                        recent.forEach { item ->
                            FurkanSurfaceCard(
                                onClick = {
                                    query = item
                                    viewModel.onQuery(item)
                                },
                            ) {
                                Row(
                                    Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(item, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
                                    TextButton(onClick = { viewModel.removeRecent(item) }) {
                                        Text("Sil")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else if (results.isEmpty() && error == null) {
            FurkanEmptyState("Sonuç yok", "Aramanızla eşleşen ürün bulunamadı.")
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(FurkanSpacing.md),
                horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
                verticalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
            ) {
                items(results, key = { it.id }) { product ->
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
            }
        }
    }
}
