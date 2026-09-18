package com.furkansogutma.app.feature.product.presentation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.product.domain.usecase.GetProductsUseCase
import com.furkansogutma.app.feature.product.domain.model.Product
import com.furkansogutma.app.feature.product.domain.model.ProductQuery
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProductListUiState(
    val isLoading: Boolean = true,
    val products: List<Product> = emptyList(),
    val error: String? = null,
    val sort: String = "recommended",
    val page: Int = 1,
    val totalPages: Int = 1,
    val category: String? = null,
)

sealed interface ProductListEvent {
    data object Retry : ProductListEvent
    data class SortChanged(val sort: String) : ProductListEvent
    data object NextPage : ProductListEvent
}

@HiltViewModel
class ProductListViewModel @Inject constructor(
    private val getProducts: GetProductsUseCase,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {
    private val category = savedStateHandle.get<String>("category") ?: savedStateHandle.get<String>("slug")
    private val _uiState = MutableStateFlow(ProductListUiState(category = category))
    val uiState = _uiState.asStateFlow()

    init { load() }

    fun onEvent(event: ProductListEvent) {
        when (event) {
            ProductListEvent.Retry -> load()
            is ProductListEvent.SortChanged -> {
                _uiState.update { it.copy(sort = event.sort, page = 1) }
                load()
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

    private fun load(append: Boolean = false) {
        viewModelScope.launch {
            if (!append) _uiState.update { it.copy(isLoading = true, error = null) }
            val state = _uiState.value
            when (
                val result = getProducts(
                    ProductQuery(
                        page = state.page,
                        sort = state.sort,
                        category = state.category,
                    ),
                )
            ) {
                is Result.Success -> _uiState.update {
                    it.copy(
                        isLoading = false,
                        products = if (append) it.products + result.data.items else result.data.items,
                        totalPages = result.data.totalPages,
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
