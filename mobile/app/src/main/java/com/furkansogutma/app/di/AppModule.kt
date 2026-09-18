package com.furkansogutma.app.di

import com.furkansogutma.app.BuildConfig
import com.furkansogutma.app.core.network.ApiConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideApiConfig(): ApiConfig = ApiConfig(
        baseUrl = BuildConfig.API_BASE_URL,
        enableLogging = BuildConfig.ENABLE_NETWORK_LOGS,
    )
}
