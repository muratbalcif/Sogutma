package com.furkansogutma.app.feature.notification.presentation

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.furkansogutma.app.core.designsystem.theme.FurkanSogutmaTheme
import com.furkansogutma.app.feature.notification.domain.model.AppNotification
import org.junit.Rule
import org.junit.Test

class NotificationsScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun listsNotificationTitles() {
        composeRule.setContent {
            FurkanSogutmaTheme {
                NotificationsListContent(
                    notifications = listOf(
                        AppNotification(
                            id = "n1",
                            type = "ORDER_SHIPPED",
                            title = "Sipariş kargoda",
                            body = "FS-1 yola çıktı",
                            entityType = "ORDER",
                            entityId = "o1",
                            productSlug = null,
                            orderId = "o1",
                            readAt = null,
                            createdAt = "2026-01-01",
                        ),
                    ),
                )
            }
        }
        composeRule.onNodeWithText("Sipariş kargoda").assertIsDisplayed()
        composeRule.onNodeWithText("FS-1 yola çıktı").assertIsDisplayed()
    }
}
