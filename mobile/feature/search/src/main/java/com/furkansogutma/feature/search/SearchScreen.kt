package com.furkansogutma.feature.search

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.core.common.result.Result
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
) : ViewModel() {
    private val _results = MutableStateFlow<List<Product>>(emptyList())
    val results = _results.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()
    private var job: Job? = null

    fun onQuery(q: String) {
        job?.cancel()
        job = viewModelScope.launch {
            delay(350)
            if (q.isBlank()) {
                _results.value = emptyList()
                return@launch
            }
            when (val result = searchProducts(q)) {
                is Result.Success -> {
                    _results.value = result.data.items
                    _error.value = null
                }
                is Result.Error -> _error.value = result.error.message
            }
        }
    }
}

@Composable
fun SearchRoute(
    onProductClick: (String) -> Unit,
    viewModel: SearchViewModel = hiltViewModel(),
) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<Product>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        launch { viewModel.results.collect { results = it } }
        launch { viewModel.error.collect { error = it } }
    }
    Column(Modifier.fillMaxSize().padding(FurkanSpacing.md)) {
        FurkanSearchBar(query, {
            query = it
            viewModel.onQuery(it)
        })
        if (error != null) Text(error!!)
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
