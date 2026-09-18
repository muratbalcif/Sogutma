package com.furkansogutma.app.feature.account

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.designsystem.components.FurkanEmptyState
import com.furkansogutma.core.designsystem.components.FurkanError
import com.furkansogutma.core.designsystem.components.FurkanLoading
import com.furkansogutma.core.designsystem.components.FurkanTopBar
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.domain.notification.AppNotification
import kotlinx.coroutines.launch

@Composable
fun NotificationsRoute(
    onOrderClick: (String) -> Unit,
    onProductClick: (String) -> Unit,
    onBack: () -> Unit = {},
    vm: AccountDataViewModel = hiltViewModel(),
) {
    var items by remember { mutableStateOf<List<AppNotification>?>(null) }
    var unread by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun refresh() {
        scope.launch {
            when (val result = vm.notificationRepository.getNotifications()) {
                is Result.Success -> {
                    items = result.data
                    error = null
                }
                is Result.Error -> error = result.error.message
            }
            when (val count = vm.notificationRepository.getUnreadCount()) {
                is Result.Success -> unread = count.data.count
                is Result.Error -> Unit
            }
        }
    }

    LaunchedEffect(Unit) { refresh() }

    Column(Modifier.fillMaxSize()) {
        FurkanTopBar(
            title = if (unread > 0) "Bildirimler ($unread)" else "Bildirimler",
            onBack = onBack,
            actions = {
                if (!items.isNullOrEmpty()) {
                    TextButton(onClick = {
                        scope.launch {
                            vm.notificationRepository.markAllAsRead()
                            refresh()
                        }
                    }) {
                        Text("Tümünü oku")
                    }
                }
            },
        )
        when {
            error != null && items == null -> FurkanError(error!!, onRetry = { refresh() })
            items == null -> FurkanLoading()
            items!!.isEmpty() -> FurkanEmptyState("Bildirim yok", "Sipariş ve stok bildirimleriniz burada.")
            else -> NotificationsListContent(
                notifications = items!!,
                onClick = { notification ->
                    scope.launch {
                        if (notification.isUnread) {
                            vm.notificationRepository.markAsRead(notification.id)
                            items = items?.map {
                                if (it.id == notification.id) it.copy(readAt = "read") else it
                            }
                            unread = (unread - 1).coerceAtLeast(0)
                        }
                    }
                    val entity = notification.entityType?.uppercase()
                    when {
                        entity == "ORDER" || entity == "PAYMENT" -> {
                            (notification.orderId ?: notification.entityId)?.let(onOrderClick)
                        }
                        entity == "PRODUCT" -> {
                            notification.productSlug?.let(onProductClick)
                        }
                    }
                },
            )
        }
    }
}

@Composable
fun NotificationsListContent(
    notifications: List<AppNotification>,
    onClick: (AppNotification) -> Unit = {},
) {
    LazyColumn(Modifier.padding(FurkanSpacing.md)) {
        items(notifications, key = { it.id }) { notification ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable { onClick(notification) }
                    .padding(vertical = FurkanSpacing.sm),
                verticalAlignment = Alignment.Top,
            ) {
                if (notification.isUnread) {
                    Surface(
                        Modifier
                            .padding(top = 6.dp)
                            .size(8.dp)
                            .clip(CircleShape),
                        color = MaterialTheme.colorScheme.primary,
                    ) {}
                    Spacer(Modifier.width(FurkanSpacing.sm))
                } else {
                    Spacer(Modifier.width(16.dp))
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        notification.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = if (notification.isUnread) FontWeight.SemiBold else FontWeight.Normal,
                    )
                    Text(notification.body, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(notification.createdAt, style = MaterialTheme.typography.bodySmall)
                }
            }
            Spacer(Modifier.height(FurkanSpacing.xs))
        }
    }
}
