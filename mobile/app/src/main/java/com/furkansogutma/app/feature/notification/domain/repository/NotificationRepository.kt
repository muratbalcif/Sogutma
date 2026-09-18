package com.furkansogutma.app.feature.notification.domain.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.notification.domain.model.AppNotification
import com.furkansogutma.app.feature.notification.domain.model.NotificationPreferences
import com.furkansogutma.app.feature.notification.domain.model.UnreadCount

interface NotificationRepository {
    suspend fun getNotifications(page: Int = 1, unreadOnly: Boolean = false): Result<List<AppNotification>>
    suspend fun getUnreadCount(): Result<UnreadCount>
    suspend fun markAsRead(id: String): Result<AppNotification>
    suspend fun markAllAsRead(): Result<Int>
    suspend fun getPreferences(): Result<NotificationPreferences>
    suspend fun updatePreferences(prefs: NotificationPreferences): Result<NotificationPreferences>
}
