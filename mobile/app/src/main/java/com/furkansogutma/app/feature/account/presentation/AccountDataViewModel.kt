package com.furkansogutma.app.feature.account.presentation

import androidx.lifecycle.ViewModel
import com.furkansogutma.app.core.datastore.AppSettingsDataStore
import com.furkansogutma.app.feature.account.domain.repository.AccountRepository
import com.furkansogutma.app.feature.auth.domain.repository.AuthRepository
import com.furkansogutma.app.feature.notification.domain.repository.NotificationRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class AccountDataViewModel @Inject constructor(
    val accountRepository: AccountRepository,
    val notificationRepository: NotificationRepository,
    val settings: AppSettingsDataStore,
    val authRepository: AuthRepository,
) : ViewModel()
