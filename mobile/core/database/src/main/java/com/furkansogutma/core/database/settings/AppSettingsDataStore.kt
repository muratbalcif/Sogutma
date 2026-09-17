package com.furkansogutma.core.database.settings

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
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
    private val themeKey = stringPreferencesKey("theme_mode")
    private val recentSearchesKey = stringSetPreferencesKey("recent_searches")
    private val pendingDeepLinkKey = stringPreferencesKey("pending_deep_link")

    val fcmToken: Flow<String?> = context.appSettingsDataStore.data.map { it[fcmTokenKey] }
    val themeMode: Flow<String> = context.appSettingsDataStore.data.map { it[themeKey] ?: "system" }
    val recentSearches: Flow<List<String>> = context.appSettingsDataStore.data.map {
        it[recentSearchesKey].orEmpty().toList().sorted()
    }
    val pendingDeepLink: Flow<String?> = context.appSettingsDataStore.data.map { it[pendingDeepLinkKey] }

    suspend fun saveFcmToken(token: String) {
        context.appSettingsDataStore.edit { it[fcmTokenKey] = token }
    }

    suspend fun clearFcmToken() {
        context.appSettingsDataStore.edit { it.remove(fcmTokenKey) }
    }

    suspend fun setThemeMode(mode: String) {
        context.appSettingsDataStore.edit { it[themeKey] = mode }
    }

    suspend fun addRecentSearch(query: String) {
        val q = query.trim()
        if (q.isBlank()) return
        context.appSettingsDataStore.edit { prefs ->
            val current = prefs[recentSearchesKey].orEmpty().toMutableSet()
            current.remove(q)
            current.add(q)
            prefs[recentSearchesKey] = current.take(10).toSet()
        }
    }

    suspend fun removeRecentSearch(query: String) {
        context.appSettingsDataStore.edit { prefs ->
            val current = prefs[recentSearchesKey].orEmpty().toMutableSet()
            current.remove(query)
            prefs[recentSearchesKey] = current
        }
    }

    suspend fun clearRecentSearches() {
        context.appSettingsDataStore.edit { it.remove(recentSearchesKey) }
    }

    suspend fun setPendingDeepLink(link: String?) {
        context.appSettingsDataStore.edit {
            if (link.isNullOrBlank()) it.remove(pendingDeepLinkKey) else it[pendingDeepLinkKey] = link
        }
    }
}
