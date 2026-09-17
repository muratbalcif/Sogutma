package com.furkansogutma.core.database.settings

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.appSettingsDataStore by preferencesDataStore("fs_app_settings")

@Singleton
class AppSettingsDataStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val fcmTokenKey = stringPreferencesKey("fcm_token")

    val fcmToken: Flow<String?> = context.appSettingsDataStore.data.map { it[fcmTokenKey] }

    suspend fun saveFcmToken(token: String) {
        context.appSettingsDataStore.edit { it[fcmTokenKey] = token }
    }

    suspend fun clearFcmToken() {
        context.appSettingsDataStore.edit { it.remove(fcmTokenKey) }
    }
}
