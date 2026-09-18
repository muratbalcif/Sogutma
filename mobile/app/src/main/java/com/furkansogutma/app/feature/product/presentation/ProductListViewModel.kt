package com.furkansogutma.app.feature.product.presentation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.category.domain.model.Category
import com.furkansogutma.app.feature.category.domain.repository.CategoryRepository
import com.furkansogutma.app.feature.product.domain.model.Brand
import com.furkansogutma.app.feature.product.domain.model.Product
import com.furkansogutma.app.feature.product.domain.model.ProductQuery
import com.furkansogutma.app.feature.product.domain.repository.ProductRepository
import com.furkansogutma.app.feature.product.domain.usecase.GetProductsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProductListFilters(
    val category: String? = null,
    val brand: String? = null,
    val minPrice: String = "",
    val maxPrice: String = "",
    val inStock: Boolean = false,
    val onCampaign: Boolean = false,
) {
    fun activeCount(): Int {
        var count = 0
        if (!category.isNullOrBlank()) count++
        if (!brand.isNullOrBlank()) count++
        if (minPrice.isNotBlank()) count++
        if (maxPrice.isNotBlank()) count++
        if (inStock) count++
        if (onCampaign) count++
        return count
    }
}

data class ProductListUiState(
    val isLoading: Boolean = true,
    val products: List<Product> = emptyList(),
    val error: String? = null,
    val sort: String = "newest",
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
    val search: String = "",
    val searchDraft: String = "",
    val filters: ProductListFilters = ProductListFilters(),
    val draftFilters: ProductListFilters = ProductListFilters(),
    val brands: List<Brand> = emptyList(),
    val categories: List<Category> = emptyList(),
    val showFiltersSheet: Boolean = false,
    val showSortSheet: Boolean = false,
)

sealed interface ProductListEvent {
    data object Retry : ProductListEvent
    data object OpenFilters : ProductListEvent
    data object CloseFilters : ProductListEvent
    data object OpenSort : ProductListEvent
    data object CloseSort : ProductListEvent
    data class DraftFiltersChanged(val filters: ProductListFilters) : ProductListEvent
    data object ApplyFilters : ProductListEvent
    data object ClearFilters : ProductListEvent
    data class RemoveFilter(val key: String) : ProductListEvent
    data class SortChanged(val sort: String) : ProductListEvent
    data class SearchDraftChanged(val query: String) : ProductListEvent
    data object ApplySearch : ProductListEvent
    data object NextPage : ProductListEvent
}

@HiltViewModel
class ProductListViewModel @Inject constructor(
    private val getProducts: GetProductsUseCase,
    private val productRepository: ProductRepository,
    private val categoryRepository: CategoryRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {
    private val initialCategory =
        savedStateHandle.get<String>("category") ?: savedStateHandle.get<String>("slug")
    private val initialFilters = ProductListFilters(category = initialCategory)
    private val _uiState = MutableStateFlow(
        ProductListUiState(
            filters = initialFilters,
            draftFilters = initialFilters,
        ),
    )
    val uiState = _uiState.asStateFlow()
    private var searchJob: Job? = null

    init {
        loadMeta()
        load()
    }

    fun onEvent(event: ProductListEvent) {
        when (event) {
            ProductListEvent.Retry -> load()
            ProductListEvent.OpenFilters -> _uiState.update {
                it.copy(showFiltersSheet = true, draftFilters = it.filters)
            }
            ProductListEvent.CloseFilters -> _uiState.update { it.copy(showFiltersSheet = false) }
            ProductListEvent.OpenSort -> _uiState.update { it.copy(showSortSheet = true) }
            ProductListEvent.CloseSort -> _uiState.update { it.copy(showSortSheet = false) }
            is ProductListEvent.DraftFiltersChanged -> _uiState.update {
                it.copy(draftFilters = event.filters)
            }
            ProductListEvent.ApplyFilters -> {
                _uiState.update {
                    it.copy(
                        filters = it.draftFilters,
                        showFiltersSheet = false,
                        page = 1,
                    )
                }
                load()
            }
            ProductListEvent.ClearFilters -> {
                val cleared = ProductListFilters()
                _uiState.update {
                    it.copy(
                        filters = cleared,
                        draftFilters = cleared,
                        showFiltersSheet = false,
                        page = 1,
                    )
                }
                load()
            }
            is ProductListEvent.RemoveFilter -> {
                when (event.key) {
                    "search" -> {
                        _uiState.update {
                            it.copy(search = "", searchDraft = "", page = 1)
                        }
                    }
                    else -> {
                        val next = when (event.key) {
                            "category" -> _uiState.value.filters.copy(category = null)
                            "brand" -> _uiState.value.filters.copy(brand = null)
                            "minPrice" -> _uiState.value.filters.copy(minPrice = "")
                            "maxPrice" -> _uiState.value.filters.copy(maxPrice = "")
                            "inStock" -> _uiState.value.filters.copy(inStock = false)
                            "onCampaign" -> _uiState.value.filters.copy(onCampaign = false)
                            else -> _uiState.value.filters
                        }
                        _uiState.update { it.copy(filters = next, draftFilters = next, page = 1) }
                    }
                }
                load()
            }
            is ProductListEvent.SortChanged -> {
                _uiState.update {
                    it.copy(sort = event.sort, page = 1, showSortSheet = false)
                }
                load()
            }
            is ProductListEvent.SearchDraftChanged -> {
                _uiState.update { it.copy(searchDraft = event.query) }
                searchJob?.cancel()
                searchJob = viewModelScope.launch {
                    delay(400)
                    applySearch(event.query)
                }
            }
            ProductListEvent.ApplySearch -> {
                searchJob?.cancel()
                applySearch(_uiState.value.searchDraft)
            }
            ProductListEvent.NextPage -> {
                val state = _uiState.value
                if (state.page < state.totalPages) {
                    _uiState.update { it.copy(page = it.page + 1) }
                    load(append = true)
                }
            }
        }
    }

    private fun applySearch(query: String) {
        val normalized = query.trim()
        if (normalized == _uiState.value.search) return
        _uiState.update { it.copy(search = normalized, searchDraft = query, page = 1) }
        load()
    }

    private fun loadMeta() {
        viewModelScope.launch {
            val brands = when (val result = productRepository.getBrands()) {
                is Result.Success -> result.data
                is Result.Error -> emptyList()
            }
            val categories = when (val result = categoryRepository.getCategories()) {
                is Result.Success -> flattenCategories(result.data)
                is Result.Error -> emptyList()
            }
            _uiState.update { it.copy(brands = brands, categories = categories) }
        }
    }

    private fun load(append: Boolean = false) {
        viewModelScope.launch {
            if (!append) _uiState.update { it.copy(isLoading = true, error = null) }
            val state = _uiState.value
            val filters = state.filters
            when (
                val result = getProducts(
                    ProductQuery(
                        page = state.page,
                        sort = state.sort,
                        search = state.search.ifBlank { null },
                        category = filters.category,
                        brand = filters.brand,
                        minPrice = filters.minPrice.ifBlank { null },
                        maxPrice = filters.maxPrice.ifBlank { null },
                        inStock = filters.inStock.takeIf { it },
                        onCampaign = filters.onCampaign.takeIf { it },
                    ),
                )
            ) {
                is Result.Success -> _uiState.update {
                    it.copy(
                        isLoading = false,
                        products = if (append) it.products + result.data.items else result.data.items,
                        totalPages = result.data.totalPages,
                        total = result.data.total,
                        error = null,
                    )
                }
                is Result.Error -> _uiState.update {
                    it.copy(isLoading = false, error = result.error.message)
                }
            }
        }
    }
}

private fun flattenCategories(categories: List<Category>): List<Category> {
    val result = mutableListOf<Category>()
    fun walk(nodes: List<Category>, depth: Int) {
        nodes.forEach { node ->
            val prefix = if (depth > 0) "${"· ".repeat(depth)}" else ""
            result += node.copy(name = "$prefix${node.name}", children = emptyList())
            if (node.children.isNotEmpty()) walk(node.children, depth + 1)
        }
    }
    walk(categories, 0)
    return result
}
