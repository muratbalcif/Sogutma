package com.furkansogutma.app.feature.product

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.core.common.result.AppError
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.cart.AddToCartUseCase
import com.furkansogutma.domain.cart.CartBadgeStore
import com.furkansogutma.domain.favorite.FavoriteRepository
import com.furkansogutma.domain.product.GetProductUseCase
import com.furkansogutma.domain.product.Product
import com.furkansogutma.domain.product.ProductRepository
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
    data class Success(
        val product: Product,
        val quantity: Int = 1,
        val isFavorite: Boolean = false,
    ) : ProductDetailUiState
    data class Error(val message: String) : ProductDetailUiState
}

sealed interface RelatedProductsUiState {
    data object Loading : RelatedProductsUiState
    data object Empty : RelatedProductsUiState
    data class Success(val products: List<Product>) : RelatedProductsUiState
    data class Error(val message: String) : RelatedProductsUiState
}

sealed interface ProductDetailEvent {
    data object Retry : ProductDetailEvent
    data object RetryRelated : ProductDetailEvent
    data object Increment : ProductDetailEvent
    data object Decrement : ProductDetailEvent
    data object AddToCart : ProductDetailEvent
    data object ToggleFavorite : ProductDetailEvent
    data object CreateAlert : ProductDetailEvent
}

@HiltViewModel
class ProductDetailViewModel @Inject constructor(
    private val getProduct: GetProductUseCase,
    private val products: ProductRepository,
    private val addToCart: AddToCartUseCase,
    private val favorites: FavoriteRepository,
    private val accountRepository: AccountRepository,
    private val badgeStore: CartBadgeStore,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {
    private val slug = checkNotNull(savedStateHandle.get<String>("slug"))
    private val _uiState = MutableStateFlow<ProductDetailUiState>(ProductDetailUiState.Loading)
    val uiState = _uiState.asStateFlow()
    private val _relatedState =
        MutableStateFlow<RelatedProductsUiState>(RelatedProductsUiState.Loading)
    val relatedState = _relatedState.asStateFlow()
    private val _messages = MutableSharedFlow<String>()
    val messages = _messages.asSharedFlow()

    init {
        load()
        loadRelated()
    }

    fun onEvent(event: ProductDetailEvent) {
        when (event) {
            ProductDetailEvent.Retry -> load()
            ProductDetailEvent.RetryRelated -> loadRelated()
            ProductDetailEvent.Increment -> _uiState.update {
                if (it is ProductDetailUiState.Success) it.copy(quantity = it.quantity + 1) else it
            }
            ProductDetailEvent.Decrement -> _uiState.update {
                if (it is ProductDetailUiState.Success) {
                    it.copy(quantity = (it.quantity - 1).coerceAtLeast(1))
                } else {
                    it
                }
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

    private fun loadRelated() {
        viewModelScope.launch {
            _relatedState.value = RelatedProductsUiState.Loading
            _relatedState.value = when (val result = products.getRelatedProducts(slug)) {
                is Result.Success ->
                    if (result.data.isEmpty()) {
                        RelatedProductsUiState.Empty
                    } else {
                        RelatedProductsUiState.Success(result.data)
                    }
                is Result.Error -> RelatedProductsUiState.Error(result.error.message)
            }
        }
    }

    private fun addCart() {
        val state = _uiState.value as? ProductDetailUiState.Success ?: return
        viewModelScope.launch {
            when (val result = addToCart(state.product.id, state.quantity)) {
                is Result.Success -> {
                    badgeStore.updateFromCart(result.data)
                    _messages.emit("Ürün sepete eklendi.")
                }
                is Result.Error -> {
                    val msg = when (result.error) {
                        is AppError.Validation ->
                            result.error.message.ifBlank { "Yeterli stok bulunmuyor." }
                        else -> result.error.message
                    }
                    _messages.emit(msg)
                }
            }
        }
    }

    private fun favorite() {
        val state = _uiState.value as? ProductDetailUiState.Success ?: return
        val previous = state.isFavorite
        _uiState.value = state.copy(isFavorite = !previous)
        viewModelScope.launch {
            val result =
                if (!previous) {
                    favorites.addFavorite(state.product.id)
                } else {
                    favorites.removeFavorite(state.product.id)
                }
            when (result) {
                is Result.Success ->
                    _messages.emit(if (!previous) "Favorilere eklendi" else "Favorilerden çıkarıldı")
                is Result.Error -> {
                    _uiState.value = state.copy(isFavorite = previous)
                    _messages.emit(result.error.message)
                }
            }
        }
    }

    private fun alert() {
        val state = _uiState.value as? ProductDetailUiState.Success ?: return
        viewModelScope.launch {
            when (val result = accountRepository.createAlert(state.product.id)) {
                is Result.Success -> _messages.emit("Stok bildirimi oluşturuldu.")
                is Result.Error -> _messages.emit(result.error.message)
            }
        }
    }
}
