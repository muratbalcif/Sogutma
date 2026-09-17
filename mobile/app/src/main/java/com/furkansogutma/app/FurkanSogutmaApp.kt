package com.furkansogutma.app

import android.app.Application
import android.util.Log
import com.furkansogutma.core.database.settings.AppSettingsDataStore
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@HiltAndroidApp
class FurkanSogutmaApp : Application() {

    @Inject lateinit var settings: AppSettingsDataStore

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        refreshFcmToken()
    }

    private fun refreshFcmToken() {
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                if (token.isNullOrBlank()) return@addOnSuccessListener
                scope.launch { settings.saveFcmToken(token) }
            }
            .addOnFailureListener { error ->
                Log.w(TAG, "FCM token fetch failed", error)
            }
    }

    companion object {
        private const val TAG = "FurkanSogutmaApp"
    }
}
