package com.furkansogutma.feature.search

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.database.settings.AppSettingsDataStore
import com.furkansogutma.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.core.designsystem.components.FurkanProductCard
import com.furkansogutma.core.designsystem.components.FurkanSearchBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.domain.product.Product
import com.furkansogutma.domain.product.SearchProductsUseCase
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

    Column(Modifier.fillMaxSize().padding(FurkanSpacing.md)) {
        FurkanSearchBar(
            query = query,
            onQueryChange = {
                query = it
                viewModel.onQuery(it)
            },
        )
        if (error != null) Text(error!!, color = MaterialTheme.colorScheme.error)
        if (emptyQuery) {
            Row(Modifier.fillMaxWidth()) {
                Text("Son aramalar", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                TextButton(onClick = viewModel::clearRecent) { Text("Temizle") }
            }
            recent.forEach { item ->
                Row(Modifier.fillMaxWidth()) {
                    Text(
                        item,
                        modifier = Modifier
                            .weight(1f)
                            .clickable {
                                query = item
                                viewModel.onQuery(item)
                            }
                            .padding(vertical = FurkanSpacing.xs),
                    )
                    TextButton(onClick = { viewModel.removeRecent(item) }) { Text("Sil") }
                }
            }
        } else if (results.isEmpty() && error == null) {
            FurkanEmptyState("Sonuç yok", "Aramanızla eşleşen ürün bulunamadı.")
        } else {
            LazyColumn {
                items(results, key = { it.id }) { product ->
                    FurkanProductCard(
                        name = product.name,
                        brand = product.brandName,
                        imageUrl = product.images.firstOrNull()?.url,
                        price = product.price?.amount,
                        compareAt = product.compareAtPrice?.amount,
                        onCampaign = product.onCampaign,
                        onClick = { onProductClick(product.slug) },
                    )
                }
            }
        }
    }
}
