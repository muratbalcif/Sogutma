package com.furkansogutma.domain.notification

import com.furkansogutma.core.common.result.Result

interface NotificationRepository {
    suspend fun getNotifications(page: Int = 1, unreadOnly: Boolean = false): Result<List<AppNotification>>
    suspend fun getUnreadCount(): Result<UnreadCount>
    suspend fun markAsRead(id: String): Result<AppNotification>
    suspend fun markAllAsRead(): Result<Int>
    suspend fun getPreferences(): Result<NotificationPreferences>
    suspend fun updatePreferences(prefs: NotificationPreferences): Result<NotificationPreferences>
}
