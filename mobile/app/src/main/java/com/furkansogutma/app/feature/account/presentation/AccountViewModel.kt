package com.furkansogutma.app.feature.account.presentation

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.core.datastore.AppSettingsDataStore
import com.furkansogutma.app.feature.account.domain.usecase.SyncDeviceTokenUseCase
import com.furkansogutma.app.feature.auth.domain.model.AuthState
import com.furkansogutma.app.feature.auth.domain.repository.AuthRepository
import com.furkansogutma.app.feature.auth.domain.usecase.LogoutUseCase
import com.furkansogutma.app.feature.cart.domain.usecase.CartBadgeStore
import com.furkansogutma.app.feature.notification.domain.repository.NotificationRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@HiltViewModel
class AccountViewModel @Inject constructor(
    authRepository: AuthRepository,
    private val logoutUseCase: LogoutUseCase,
    private val badgeStore: CartBadgeStore,
    private val syncDeviceToken: SyncDeviceTokenUseCase,
    private val settings: AppSettingsDataStore,
    private val notificationRepository: NotificationRepository,
) : ViewModel() {
    val authState = authRepository.authState.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        AuthState.Loading,
    )

    var unreadNotifications by mutableStateOf(0)
        private set

    init {
        viewModelScope.launch {
            when (val result = notificationRepository.getUnreadCount()) {
                is Result.Success -> unreadNotifications = result.data.count
                is Result.Error -> Unit
            }
        }
    }

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            val token = settings.fcmToken.first()
            syncDeviceToken.unregister(token)
            logoutUseCase()
            badgeStore.clear()
            onDone()
        }
    }
}
