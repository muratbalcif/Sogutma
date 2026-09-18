package com.furkansogutma.app.feature.campaign.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.product.domain.model.Campaign
import com.furkansogutma.app.feature.product.domain.repository.ProductRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CampaignListUiState(
    val isLoading: Boolean = true,
    val campaigns: List<Campaign> = emptyList(),
    val error: String? = null,
)

@HiltViewModel
class CampaignListViewModel @Inject constructor(
    private val products: ProductRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(CampaignListUiState())
    val uiState = _uiState.asStateFlow()

    init {
        load()
    }

    fun retry() = load()

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            when (val result = products.getCampaigns()) {
                is Result.Success -> _uiState.update {
                    it.copy(isLoading = false, campaigns = result.data, error = null)
                }
                is Result.Error -> _uiState.update {
                    it.copy(isLoading = false, error = result.error.message)
                }
            }
        }
    }
}
