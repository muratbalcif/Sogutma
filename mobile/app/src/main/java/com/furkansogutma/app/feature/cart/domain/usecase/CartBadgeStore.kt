package com.furkansogutma.app.feature.cart.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import com.furkansogutma.app.feature.cart.domain.model.Cart
import com.furkansogutma.app.feature.cart.domain.repository.CartRepository

@Singleton
class CartBadgeStore @Inject constructor() {
    private val _count = MutableStateFlow(0)
    val count = _count.asStateFlow()

    fun updateFromCart(cart: Cart) {
        _count.value = cart.items.sumOf { it.quantity }
    }

    fun clear() {
        _count.value = 0
    }
}

class RefreshCartBadgeUseCase @Inject constructor(
    private val cartRepository: CartRepository,
    private val badgeStore: CartBadgeStore,
) {
    suspend operator fun invoke(): Result<Int> {
        return when (val result = cartRepository.getCart()) {
            is Result.Success -> {
                badgeStore.updateFromCart(result.data)
                Result.Success(badgeStore.count.value)
            }
            is Result.Error -> result
        }
    }
}
