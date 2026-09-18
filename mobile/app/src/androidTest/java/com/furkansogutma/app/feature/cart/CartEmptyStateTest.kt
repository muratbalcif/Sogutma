package com.furkansogutma.app.feature.cart

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.furkansogutma.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.core.designsystem.theme.FurkanSogutmaTheme
import org.junit.Rule
import org.junit.Test

class CartEmptyStateTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun emptyCartMessageVisible() {
        composeRule.setContent {
            FurkanSogutmaTheme {
                FurkanEmptyState("Sepetiniz boş", "Ürün ekleyerek başlayın", "Ürünlere git", {})
            }
        }
        composeRule.onNodeWithText("Sepetiniz boş").assertIsDisplayed()
    }
}
