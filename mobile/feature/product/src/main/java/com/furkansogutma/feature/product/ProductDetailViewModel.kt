package com.furkansogutma.feature.product

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.cart.AddToCartUseCase
import com.furkansogutma.domain.favorite.FavoriteRepository
import com.furkansogutma.domain.product.GetProductUseCase
import com.furkansogutma.domain.product.Product
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface ProductDetailUiState {
    data object Loading : ProductDetailUiState
    data class Success(val product: Product, val quantity: Int = 1, val message: String? = null) : ProductDetailUiState
    data class Error(val message: String) : ProductDetailUiState
}

sealed interface ProductDetailEvent {
    data object Retry : ProductDetailEvent
    data object Increment : ProductDetailEvent
    data object Decrement : ProductDetailEvent
    data object AddToCart : ProductDetailEvent
    data object ToggleFavorite : ProductDetailEvent
    data object CreateAlert : ProductDetailEvent
}

@HiltViewModel
class ProductDetailViewModel @Inject constructor(
    private val getProduct: GetProductUseCase,
    private val addToCart: AddToCartUseCase,
    private val favorites: FavoriteRepository,
    private val accountRepository: AccountRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {
    private val slug = checkNotNull(savedStateHandle.get<String>("slug"))
    private val _uiState = MutableStateFlow<ProductDetailUiState>(ProductDetailUiState.Loading)
    val uiState = _uiState.asStateFlow()
    private val _messages = MutableSharedFlow<String>()
    val messages = _messages.asSharedFlow()

    init { load() }

    fun onEvent(event: ProductDetailEvent) {
        when (event) {
            ProductDetailEvent.Retry -> load()
            ProductDetailEvent.Increment -> _uiState.update {
                if (it is ProductDetailUiState.Success) it.copy(quantity = it.quantity + 1) else it
            }
            ProductDetailEvent.Decrement -> _uiState.update {
                if (it is ProductDetailUiState.Success) it.copy(quantity = (it.quantity - 1).coerceAtLeast(1)) else it
            }
            ProductDetailEvent.AddToCart -> addCart()
            ProductDetailEvent.ToggleFavorite -> favorite()
            ProductDetailEvent.CreateAlert -> alert()
        }
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.value = ProductDetailUiState.Loading
            _uiState.value = when (val result = getProduct(slug)) {
                is Result.Success -> ProductDetailUiState.Success(result.data)
                is Result.Error -> ProductDetailUiState.Error(result.error.message)
            }
        }
    }

    private fun addCart() {
        val state = _uiState.value as? ProductDetailUiState.Success ?: return
        viewModelScope.launch {
            when (val result = addToCart(state.product.id, state.quantity)) {
                is Result.Success -> _messages.emit("Sepete eklendi")
                is Result.Error -> _messages.emit(result.error.message)
            }
        }
    }

    private fun favorite() {
        val state = _uiState.value as? ProductDetailUiState.Success ?: return
        viewModelScope.launch {
            when (val result = favorites.addFavorite(state.product.id)) {
                is Result.Success -> _messages.emit("Favorilere eklendi")
                is Result.Error -> _messages.emit(result.error.message)
            }
        }
    }

    private fun alert() {
        val state = _uiState.value as? ProductDetailUiState.Success ?: return
        viewModelScope.launch {
            when (val result = accountRepository.createAlert(state.product.id)) {
                is Result.Success -> _messages.emit("Stok bildirimi oluşturuldu")
                is Result.Error -> _messages.emit(result.error.message)
            }
        }
    }
}
