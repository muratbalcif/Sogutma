package com.furkansogutma.app.feature.cart.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.cart.domain.model.Cart
import com.furkansogutma.app.feature.cart.domain.usecase.CartBadgeStore
import com.furkansogutma.app.feature.cart.domain.model.CartValidation
import com.furkansogutma.app.feature.cart.domain.usecase.GetCartUseCase
import com.furkansogutma.app.feature.cart.domain.usecase.UpdateCartItemUseCase
import com.furkansogutma.app.feature.cart.domain.repository.CartRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface CartUiState {
    data object Loading : CartUiState
    data class Success(val cart: Cart, val validation: CartValidation? = null) : CartUiState
    data class Error(val message: String) : CartUiState
}

sealed interface CartEvent {
    data object Retry : CartEvent
    data class UpdateQty(val productId: String, val quantity: Int) : CartEvent
    data class Remove(val productId: String) : CartEvent
    data object ValidateForCheckout : CartEvent
}

sealed interface CartEffect {
    data object ProceedCheckout : CartEffect
    data class Message(val text: String) : CartEffect
}

@HiltViewModel
class CartViewModel @Inject constructor(
    private val getCart: GetCartUseCase,
    private val updateCartItem: UpdateCartItemUseCase,
    private val cartRepository: CartRepository,
    private val badgeStore: CartBadgeStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow<CartUiState>(CartUiState.Loading)
    val uiState = _uiState.asStateFlow()
    private val _effects = MutableSharedFlow<CartEffect>()
    val effects = _effects.asSharedFlow()

    init { load() }

    fun onEvent(event: CartEvent) {
        when (event) {
            CartEvent.Retry -> load()
            is CartEvent.UpdateQty -> mutate(event.productId, event.quantity)
            is CartEvent.Remove -> mutate(event.productId, 0)
            CartEvent.ValidateForCheckout -> validate()
        }
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.value = CartUiState.Loading
            when (val result = getCart()) {
                is Result.Success -> {
                    badgeStore.updateFromCart(result.data)
                    _uiState.value = CartUiState.Success(result.data)
                }
                is Result.Error -> _uiState.value = CartUiState.Error(result.error.message)
            }
        }
    }

    private fun mutate(productId: String, quantity: Int) {
        viewModelScope.launch {
            when (val result = updateCartItem(productId, quantity)) {
                is Result.Success -> {
                    badgeStore.updateFromCart(result.data)
                    _uiState.value = CartUiState.Success(result.data)
                }
                is Result.Error -> _effects.emit(CartEffect.Message(result.error.message))
            }
        }
    }

    private fun validate() {
        viewModelScope.launch {
            when (val result = cartRepository.validate()) {
                is Result.Success -> {
                    val current = (_uiState.value as? CartUiState.Success)?.cart
                    if (current != null) {
                        _uiState.value = CartUiState.Success(current, result.data)
                    }
                    if (result.data.valid) {
                        _effects.emit(CartEffect.ProceedCheckout)
                    } else {
                        _effects.emit(
                            CartEffect.Message(
                                result.data.issues.joinToString("\n") { it.message }
                                    .ifBlank { "Sepetinizdeki bazı ürünlerde sorun var." },
                            ),
                        )
                    }
                }
                is Result.Error -> _effects.emit(CartEffect.Message(result.error.message))
            }
        }
    }
}
