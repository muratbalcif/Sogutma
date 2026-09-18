package com.furkansogutma.app.feature.home

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.furkansogutma.core.designsystem.theme.FurkanSogutmaTheme
import com.furkansogutma.domain.product.HomeCatalog
import org.junit.Rule
import org.junit.Test

class HomeScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun brandVisibleOnHome() {
        composeRule.setContent {
            FurkanSogutmaTheme {
                HomeScreen(
                    greeting = "Merhaba",
                    catalog = HomeCatalog(
                        banners = emptyList(),
                        categories = emptyList(),
                        featured = emptyList(),
                        campaigns = emptyList(),
                        bestSelling = emptyList(),
                        brands = emptyList(),
                    ),
                    cartCount = 0,
                    onProductClick = {},
                    onCategoryClick = {},
                    onSearchClick = {},
                    onCartClick = {},
                    onSeeAllProducts = {},
                )
            }
        }
        composeRule.onNodeWithText("FurkanSoğutma").assertIsDisplayed()
    }
}
