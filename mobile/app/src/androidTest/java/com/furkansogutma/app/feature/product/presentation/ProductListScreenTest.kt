package com.furkansogutma.app.feature.product.presentation

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.furkansogutma.app.core.designsystem.theme.FurkanSogutmaTheme
import com.furkansogutma.app.feature.product.domain.model.Money
import com.furkansogutma.app.feature.product.domain.model.Product
import org.junit.Rule
import org.junit.Test

class ProductListScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun productCardVisible() {
        val product = Product(
            id = "1", sku = "SKU", barcode = null, name = "Liste Ürün", slug = "liste",
            description = null, brandName = "Marka", brandSlug = "marka",
            categoryName = "Kat", categorySlug = "kat", images = emptyList(),
            price = Money("50", "TRY"), compareAtPrice = null,
            stockAvailable = true, stockQuantity = 1, onCampaign = false,
        )
        composeRule.setContent {
            FurkanSogutmaTheme {
                ProductListScreen(
                    state = ProductListUiState(isLoading = false, products = listOf(product)),
                    onEvent = {},
                    onProductClick = {},
                )
            }
        }
        composeRule.onNodeWithText("Liste Ürün").assertIsDisplayed()
    }
}
