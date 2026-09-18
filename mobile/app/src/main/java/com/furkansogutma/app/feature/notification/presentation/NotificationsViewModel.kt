package com.furkansogutma.app.feature.notification.presentation

import androidx.lifecycle.ViewModel
import com.furkansogutma.app.feature.notification.domain.repository.NotificationRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    val notificationRepository: NotificationRepository,
) : ViewModel()
