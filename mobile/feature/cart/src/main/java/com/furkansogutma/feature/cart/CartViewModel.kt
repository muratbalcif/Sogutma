package com.furkansogutma.feature.cart

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.cart.Cart
import com.furkansogutma.domain.cart.GetCartUseCase
import com.furkansogutma.domain.cart.UpdateCartItemUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface CartUiState {
    data object Loading : CartUiState
    data class Success(val cart: Cart) : CartUiState
    data class Error(val message: String) : CartUiState
}

sealed interface CartEvent {
    data object Retry : CartEvent
    data class UpdateQty(val productId: String, val quantity: Int) : CartEvent
    data class Remove(val productId: String) : CartEvent
}

@HiltViewModel
class CartViewModel @Inject constructor(
    private val getCart: GetCartUseCase,
    private val updateCartItem: UpdateCartItemUseCase,
) : ViewModel() {
    private val _uiState = MutableStateFlow<CartUiState>(CartUiState.Loading)
    val uiState = _uiState.asStateFlow()

    init { load() }

    fun onEvent(event: CartEvent) {
        when (event) {
            CartEvent.Retry -> load()
            is CartEvent.UpdateQty -> mutate(event.productId, event.quantity)
            is CartEvent.Remove -> mutate(event.productId, 0)
        }
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.value = CartUiState.Loading
            _uiState.value = when (val result = getCart()) {
                is Result.Success -> CartUiState.Success(result.data)
                is Result.Error -> CartUiState.Error(result.error.message)
            }
        }
    }

    private fun mutate(productId: String, quantity: Int) {
        viewModelScope.launch {
            when (val result = updateCartItem(productId, quantity)) {
                is Result.Success -> _uiState.value = CartUiState.Success(result.data)
                is Result.Error -> _uiState.value = CartUiState.Error(result.error.message)
            }
        }
    }
}
