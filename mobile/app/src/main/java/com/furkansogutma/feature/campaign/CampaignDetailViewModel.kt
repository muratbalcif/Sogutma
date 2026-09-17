package com.furkansogutma.feature.campaign

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.product.Campaign
import com.furkansogutma.domain.product.CampaignProduct
import com.furkansogutma.domain.product.ProductRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface CampaignDetailUiState {
    data object Loading : CampaignDetailUiState
    data class Success(
        val campaign: Campaign,
        val products: List<CampaignProduct>,
    ) : CampaignDetailUiState
    data class Error(val message: String) : CampaignDetailUiState
}

@HiltViewModel
class CampaignDetailViewModel @Inject constructor(
    private val products: ProductRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {
    private val slug = checkNotNull(savedStateHandle.get<String>("slug"))
    private val _uiState = MutableStateFlow<CampaignDetailUiState>(CampaignDetailUiState.Loading)
    val uiState = _uiState.asStateFlow()

    init {
        load()
    }

    fun retry() = load()

    private fun load() {
        viewModelScope.launch {
            _uiState.value = CampaignDetailUiState.Loading
            val campaignDeferred = async { products.getCampaignBySlug(slug) }
            val productsDeferred = async { products.getCampaignProductsBySlug(slug) }
            val campaignResult = campaignDeferred.await()
            val productsResult = productsDeferred.await()

            _uiState.value = when (campaignResult) {
                is Result.Error -> CampaignDetailUiState.Error(campaignResult.error.message)
                is Result.Success -> {
                    val productList = when (productsResult) {
                        is Result.Success -> productsResult.data
                        is Result.Error -> emptyList()
                    }
                    CampaignDetailUiState.Success(campaignResult.data, productList)
                }
            }
        }
    }
}
