package com.furkansogutma.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.auth.AuthRepository
import com.furkansogutma.domain.auth.AuthState
import com.furkansogutma.domain.cart.CartBadgeStore
import com.furkansogutma.domain.cart.RefreshCartBadgeUseCase
import com.furkansogutma.domain.product.GetHomeCatalogUseCase
import com.furkansogutma.domain.product.HomeCatalog
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed interface HomeUiState {
    data object Loading : HomeUiState
    data class Success(val catalog: HomeCatalog, val greeting: String) : HomeUiState
    data class Error(val message: String) : HomeUiState
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val getHomeCatalog: GetHomeCatalogUseCase,
    private val refreshCartBadge: RefreshCartBadgeUseCase,
    authRepository: AuthRepository,
    badgeStore: CartBadgeStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState = _uiState.asStateFlow()
    val cartCount = badgeStore.count
    private val authState = authRepository.authState.stateIn(
        viewModelScope,
        SharingStarted.Eagerly,
        AuthState.Loading,
    )

    init { load() }

    fun load() {
        viewModelScope.launch {
            _uiState.value = HomeUiState.Loading
            refreshCartBadge()
            val greeting = when (val auth = authState.value) {
                is AuthState.Authenticated -> "Merhaba, ${auth.user.firstName}"
                else -> "Merhaba"
            }
            _uiState.value = when (val result = getHomeCatalog()) {
                is Result.Success -> HomeUiState.Success(result.data, greeting)
                is Result.Error -> HomeUiState.Error(result.error.message)
            }
        }
    }
}
