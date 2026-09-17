package com.furkansogutma.feature.category

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.designsystem.components.FurkanCategoryTile
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.core.designsystem.components.FurkanTopBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.domain.category.Category
import com.furkansogutma.domain.category.CategoryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface CategoryUiState {
    data object Loading : CategoryUiState
    data class Success(val categories: List<Category>) : CategoryUiState
    data class Error(val message: String) : CategoryUiState
}

@HiltViewModel
class CategoryViewModel @Inject constructor(
    private val repository: CategoryRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow<CategoryUiState>(CategoryUiState.Loading)
    val uiState = _uiState.asStateFlow()
    init { load() }
    fun load() {
        viewModelScope.launch {
            _uiState.value = CategoryUiState.Loading
            _uiState.value = when (val result = repository.getCategories()) {
                is Result.Success -> CategoryUiState.Success(result.data)
                is Result.Error -> CategoryUiState.Error(result.error.message)
            }
        }
    }
}

@Composable
fun CategoryRoute(
    onCategoryClick: (String) -> Unit,
    viewModel: CategoryViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    Column(Modifier.fillMaxSize()) {
        FurkanTopBar(title = "Kategoriler")
        when (val s = state) {
            CategoryUiState.Loading -> FurkanLoading()
            is CategoryUiState.Error -> FurkanError(s.message, onRetry = viewModel::load)
            is CategoryUiState.Success -> CategoryGrid(s.categories, onCategoryClick)
        }
    }
}

@Composable
private fun CategoryGrid(
    categories: List<Category>,
    onCategoryClick: (String) -> Unit,
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(FurkanSpacing.md),
        horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
        verticalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
    ) {
        categories.forEach { category ->
            item(span = { GridItemSpan(2) }, key = "h-${category.id}") {
                Column(Modifier.padding(top = FurkanSpacing.sm, bottom = FurkanSpacing.xxs)) {
                    Text(
                        category.name.uppercase(),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    FurkanOutlinedButton(
                        text = "${category.name} Tümünü Göster",
                        onClick = { onCategoryClick(category.slug) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = FurkanSpacing.xs),
                    )
                }
            }
            val children = category.children.ifEmpty { listOf(category) }
            items(children, key = { it.id }) { child ->
                FurkanCategoryTile(
                    title = child.name,
                    onClick = { onCategoryClick(child.slug) },
                )
            }
        }
    }
}
