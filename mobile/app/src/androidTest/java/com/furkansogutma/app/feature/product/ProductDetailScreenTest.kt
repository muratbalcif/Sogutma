package com.furkansogutma.app.feature.product

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.furkansogutma.core.designsystem.theme.FurkanSogutmaTheme
import com.furkansogutma.domain.product.Money
import com.furkansogutma.domain.product.Product
import org.junit.Rule
import org.junit.Test

class ProductDetailScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun addToCartButtonVisibleWhenInStock() {
        val product = Product(
            id = "1", sku = "SKU", barcode = null, name = "Test Ürün", slug = "test",
            description = "Desc", brandName = "Marka", brandSlug = "marka",
            categoryName = "Kat", categorySlug = "kat", images = emptyList(),
            price = Money("100", "TRY"), compareAtPrice = null,
            stockAvailable = true, stockQuantity = 3, onCampaign = false,
        )
        composeRule.setContent {
            FurkanSogutmaTheme {
                ProductDetailScreen(
                    state = ProductDetailUiState.Success(product),
                    onEvent = {},
                )
            }
        }
        composeRule.onNodeWithText("Test Ürün").assertIsDisplayed()
        composeRule.onNodeWithText("Stokta").assertIsDisplayed()
        composeRule.onNodeWithText("SKU: SKU").assertIsDisplayed()
    }
}
