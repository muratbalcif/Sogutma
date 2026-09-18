package com.furkansogutma.app.feature.notification.domain.model

data class AppNotification(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val entityType: String?,
    val entityId: String?,
    val productSlug: String?,
    val orderId: String?,
    val readAt: String?,
    val createdAt: String,
) {
    val isUnread: Boolean get() = readAt.isNullOrBlank()
}

data class NotificationPreferences(
    val orderNotifications: Boolean,
    val paymentNotifications: Boolean,
    val stockAlerts: Boolean,
    val campaignNotifications: Boolean,
    val systemNotifications: Boolean,
)

data class UnreadCount(
    val count: Int,
)
