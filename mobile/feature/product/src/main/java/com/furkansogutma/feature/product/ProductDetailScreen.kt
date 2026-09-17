package com.furkansogutma.feature.product

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.furkansogutma.core.designsystem.components.FurkanButton
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.components.FurkanOutlinedButton
import com.furkansogutma.core.designsystem.components.FurkanPrice
import com.furkansogutma.core.designsystem.theme.FurkanSpacing

@Composable
fun ProductDetailRoute(
    viewModel: ProductDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.messages.collect { /* snackbar host can be wired in app */ } }
    when (val s = state) {
        ProductDetailUiState.Loading -> FurkanLoading()
        is ProductDetailUiState.Error -> FurkanError(s.message) { viewModel.onEvent(ProductDetailEvent.Retry) }
        is ProductDetailUiState.Success -> ProductDetailScreen(s, viewModel::onEvent)
    }
}

@Composable
fun ProductDetailScreen(
    state: ProductDetailUiState.Success,
    onEvent: (ProductDetailEvent) -> Unit,
) {
    val product = state.product
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(FurkanSpacing.md)
            .semantics { contentDescription = "Product detail" },
    ) {
        AsyncImage(
            model = product.images.firstOrNull()?.url,
            contentDescription = "${product.name} görseli",
            modifier = Modifier.fillMaxWidth().aspectRatio(1f),
            contentScale = ContentScale.Crop,
        )
        Spacer(Modifier.height(FurkanSpacing.md))
        Text(product.brandName, style = MaterialTheme.typography.labelLarge)
        Text(product.name, style = MaterialTheme.typography.headlineLarge)
        Text("SKU: ${product.sku}", color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (product.price != null) {
            FurkanPrice(product.price!!.amount, product.compareAtPrice?.amount)
        }
        Text(if (product.stockAvailable) "Stokta" else "Stok yok")
        Spacer(Modifier.height(FurkanSpacing.md))
        Row {
            FurkanOutlinedButton("-") { onEvent(ProductDetailEvent.Decrement) }
            Text("${state.quantity}", modifier = Modifier.padding(horizontal = FurkanSpacing.md))
            FurkanOutlinedButton("+") { onEvent(ProductDetailEvent.Increment) }
        }
        Spacer(Modifier.height(FurkanSpacing.md))
        if (product.stockAvailable) {
            FurkanButton("Sepete ekle", Modifier.fillMaxWidth()) { onEvent(ProductDetailEvent.AddToCart) }
        } else {
            FurkanButton("Stoğa gelince haber ver", Modifier.fillMaxWidth()) {
                onEvent(ProductDetailEvent.CreateAlert)
            }
        }
        Spacer(Modifier.height(FurkanSpacing.sm))
        FurkanOutlinedButton("Favorilere ekle", Modifier.fillMaxWidth()) {
            onEvent(ProductDetailEvent.ToggleFavorite)
        }
        Spacer(Modifier.height(FurkanSpacing.lg))
        Text("Açıklama", style = MaterialTheme.typography.titleLarge)
        Text(product.description.orEmpty().ifBlank { "Açıklama bulunmuyor." })
        if (product.attributes.isNotEmpty()) {
            Spacer(Modifier.height(FurkanSpacing.md))
            Text("Teknik özellikler", style = MaterialTheme.typography.titleLarge)
            product.attributes.forEach { Text("${it.name}: ${it.value}") }
        }
        if (product.compatibility.isNotEmpty()) {
            Spacer(Modifier.height(FurkanSpacing.md))
            Text("Uyumluluk", style = MaterialTheme.typography.titleLarge)
            product.compatibility.forEach { Text("${it.manufacturer} ${it.model}") }
        }
        Spacer(Modifier.height(FurkanSpacing.md))
        Text("Yorumlar", style = MaterialTheme.typography.titleLarge)
        Text("Henüz yorum bulunmuyor.")
    }
}
