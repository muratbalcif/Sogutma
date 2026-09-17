package com.furkansogutma.data.notification

import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.network.api.CommerceApi
import com.furkansogutma.data.mapper.toDomain
import com.furkansogutma.data.mapper.toDto
import com.furkansogutma.data.remote.SafeApiCall
import com.furkansogutma.domain.notification.AppNotification
import com.furkansogutma.domain.notification.NotificationPreferences
import com.furkansogutma.domain.notification.NotificationRepository
import com.furkansogutma.domain.notification.UnreadCount
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NotificationRepositoryImpl @Inject constructor(
    private val api: CommerceApi,
    private val safeApiCall: SafeApiCall,
) : NotificationRepository {
    override suspend fun getNotifications(page: Int, unreadOnly: Boolean): Result<List<AppNotification>> =
        safeApiCall {
            api.notifications(page = page, unreadOnly = if (unreadOnly) true else null)
                .items
                .map { it.toDomain() }
        }

    override suspend fun getUnreadCount(): Result<UnreadCount> =
        safeApiCall { api.notificationsUnreadCount().toDomain() }

    override suspend fun markAsRead(id: String): Result<AppNotification> =
        safeApiCall { api.markNotificationRead(id).toDomain() }

    override suspend fun markAllAsRead(): Result<Int> =
        safeApiCall { api.markAllNotificationsRead().updated }

    override suspend fun getPreferences(): Result<NotificationPreferences> =
        safeApiCall { api.notificationPreferences().toDomain() }

    override suspend fun updatePreferences(prefs: NotificationPreferences): Result<NotificationPreferences> =
        safeApiCall { api.updateNotificationPreferences(prefs.toDto()).toDomain() }
}
