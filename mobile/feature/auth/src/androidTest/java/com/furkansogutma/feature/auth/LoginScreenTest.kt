package com.furkansogutma.feature.auth

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.furkansogutma.core.designsystem.theme.FurkanSogutmaTheme
import org.junit.Rule
import org.junit.Test

class LoginScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun loginFormValidationVisible() {
        composeRule.setContent {
            FurkanSogutmaTheme {
                LoginScreen(
                    state = LoginUiState(),
                    onEvent = {},
                    onRegister = {},
                )
            }
        }
        composeRule.onNodeWithText("Giriş").assertIsDisplayed()
        composeRule.onNodeWithText("Giriş yap").performClick()
    }
}
