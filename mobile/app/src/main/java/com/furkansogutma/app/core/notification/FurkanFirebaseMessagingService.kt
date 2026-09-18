package com.furkansogutma.app.core.notification

import com.furkansogutma.app.core.datastore.AppSettingsDataStore
import com.furkansogutma.app.feature.account.domain.repository.AccountRepository
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * FCM foundation. Requires `google-services.json` for production push.
 * Without it the service class still compiles; runtime registration is no-op until Firebase is configured.
 */
@AndroidEntryPoint
class FurkanFirebaseMessagingService : FirebaseMessagingService() {

    @Inject lateinit var settings: AppSettingsDataStore
    @Inject lateinit var accountRepository: AccountRepository

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        scope.launch {
            settings.saveFcmToken(token)
            accountRepository.registerDeviceToken(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // Deep-link routing is handled when notification is opened via Intent extras:
        // type=order|product|stock + id/slug
        NotificationNavigator.handle(applicationContext, message.data)
    }
}
