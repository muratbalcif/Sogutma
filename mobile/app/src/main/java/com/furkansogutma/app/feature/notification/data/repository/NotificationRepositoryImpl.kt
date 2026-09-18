package com.furkansogutma.app.feature.notification.data.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.core.network.api.CommerceApi
import com.furkansogutma.app.data.mapper.toDomain
import com.furkansogutma.app.data.mapper.toDto
import com.furkansogutma.app.core.network.SafeApiCall
import com.furkansogutma.app.feature.notification.domain.model.AppNotification
import com.furkansogutma.app.feature.notification.domain.model.NotificationPreferences
import com.furkansogutma.app.feature.notification.domain.repository.NotificationRepository
import com.furkansogutma.app.feature.notification.domain.model.UnreadCount
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
