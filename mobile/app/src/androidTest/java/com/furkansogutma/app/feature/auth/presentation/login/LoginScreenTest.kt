package com.furkansogutma.app.feature.auth.presentation.login

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.furkansogutma.app.core.designsystem.theme.FurkanSogutmaTheme
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
                    onForgotPassword = {},
                )
            }
        }
        composeRule.onNodeWithContentDescription("FurkanSoğutma").assertIsDisplayed()
        composeRule.onNodeWithText("Giriş yap").performClick()
    }
}
