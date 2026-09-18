package com.furkansogutma.app.feature.category

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanNetworkImage
import com.furkansogutma.core.designsystem.components.FurkanSearchBar
import com.furkansogutma.core.designsystem.components.FurkanSkeletonBox
import com.furkansogutma.core.designsystem.components.FurkanTopBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.core.designsystem.theme.PrimaryLight
import com.furkansogutma.core.designsystem.theme.White
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
    onBack: (() -> Unit)? = null,
    viewModel: CategoryViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        FurkanTopBar(title = "Kategoriler", onBack = onBack)
        Text(
            "Size uygun ürünleri keşfedin",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = FurkanSpacing.md, vertical = FurkanSpacing.xs),
        )
        when (val s = state) {
            CategoryUiState.Loading -> CategorySkeleton()
            is CategoryUiState.Error -> FurkanError(
                "Kategoriler yüklenemedi",
                onRetry = viewModel::load,
            )
            is CategoryUiState.Success -> {
                if (s.categories.isEmpty()) {
                    FurkanEmptyState(
                        title = "Henüz kategori bulunmuyor",
                        message = "Kategoriler yakında burada listelenecek.",
                    )
                } else {
                    CategoryBrowse(
                        categories = s.categories,
                        onCategoryClick = onCategoryClick,
                    )
                }
            }
        }
    }
}

@Composable
private fun CategoryBrowse(
    categories: List<Category>,
    onCategoryClick: (String) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val flat by remember(categories, query) {
        derivedStateOf {
            val leaves = flattenCategories(categories)
            val q = query.trim()
            if (q.isEmpty()) leaves
            else leaves.filter {
                it.displayName().contains(q, ignoreCase = true)
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        if (categories.size > 6) {
            FurkanSearchBar(
                query = query,
                onQueryChange = { query = it },
                placeholder = "Kategori ara",
                modifier = Modifier
                    .padding(horizontal = FurkanSpacing.md)
                    .padding(bottom = FurkanSpacing.sm),
            )
        }
        if (flat.isEmpty()) {
            FurkanEmptyState(
                title = "Sonuç yok",
                message = "Aramanıza uygun kategori bulunamadı.",
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier
                    .fillMaxSize()
                    .semantics { contentDescription = "Kategori listesi" },
                contentPadding = PaddingValues(FurkanSpacing.md),
                horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
                verticalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
            ) {
                items(flat, key = { it.id }) { category ->
                    CategoryCard(
                        category = category,
                        onClick = { onCategoryClick(category.slug) },
                    )
                }
            }
        }
    }
}

@Composable
private fun CategoryCard(
    category: Category,
    onClick: () -> Unit,
) {
    val label = category.displayName()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .height(220.dp)
            .shadow(4.dp, MaterialTheme.shapes.medium, clip = false)
            .clip(MaterialTheme.shapes.medium)
            .border(1.dp, MaterialTheme.colorScheme.outline, MaterialTheme.shapes.medium)
            .background(White)
            .clickable(onClick = onClick)
            .padding(FurkanSpacing.sm)
            .semantics { contentDescription = label },
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(112.dp)
                .clip(MaterialTheme.shapes.small)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            val image = category.image?.trim().orEmpty()
            if (image.isNotEmpty()) {
                FurkanNetworkImage(
                    url = image,
                    contentDescription = label,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(
                    Modifier
                        .size(52.dp)
                        .clip(CircleShape)
                        .background(PrimaryLight),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        label.take(1).uppercase(),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
        Spacer(Modifier.height(FurkanSpacing.sm))
        Text(
            label,
            style = MaterialTheme.typography.titleSmall.copy(fontSize = 16.sp),
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            minLines = 2,
        )
        Spacer(Modifier.height(FurkanSpacing.xxs))
        Text(
            "Ürünleri gör →",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}

@Composable
private fun CategorySkeleton() {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        contentPadding = PaddingValues(FurkanSpacing.md),
        horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
        verticalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
        modifier = Modifier.fillMaxSize(),
    ) {
        item(span = { GridItemSpan(2) }) {
            FurkanSkeletonBox(Modifier.fillMaxWidth().height(54.dp))
        }
        items(6) {
            FurkanSkeletonBox(Modifier.fillMaxWidth().height(220.dp))
        }
    }
}

private fun Category.displayName(): String {
    val n = name.trim()
    if (n.isNotEmpty()) return n
    val s = slug.trim()
    if (s.isNotEmpty()) return s.replace('-', ' ')
    return "Kategori"
}

private fun flattenCategories(categories: List<Category>): List<Category> {
    val result = mutableListOf<Category>()
    fun walk(list: List<Category>) {
        for (cat in list) {
            if (cat.children.isEmpty()) {
                result.add(cat)
            } else {
                result.add(cat)
                walk(cat.children)
            }
        }
    }
    walk(categories)
    return result.distinctBy { it.id }
}
