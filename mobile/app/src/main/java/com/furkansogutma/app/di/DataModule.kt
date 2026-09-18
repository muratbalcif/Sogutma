package com.furkansogutma.app.di

import com.furkansogutma.app.feature.account.data.repository.AccountRepositoryImpl
import com.furkansogutma.app.feature.auth.data.repository.AuthRepositoryImpl
import com.furkansogutma.app.feature.cart.data.repository.CartRepositoryImpl
import com.furkansogutma.app.feature.category.data.repository.CategoryRepositoryImpl
import com.furkansogutma.app.feature.favorite.data.repository.FavoriteRepositoryImpl
import com.furkansogutma.app.feature.notification.data.repository.NotificationRepositoryImpl
import com.furkansogutma.app.feature.order.data.repository.OrderRepositoryImpl
import com.furkansogutma.app.feature.product.data.repository.ProductRepositoryImpl
import com.furkansogutma.app.feature.account.domain.repository.AccountRepository
import com.furkansogutma.app.feature.auth.domain.repository.AuthRepository
import com.furkansogutma.app.feature.cart.domain.repository.CartRepository
import com.furkansogutma.app.feature.category.domain.repository.CategoryRepository
import com.furkansogutma.app.feature.favorite.domain.repository.FavoriteRepository
import com.furkansogutma.app.feature.notification.domain.repository.NotificationRepository
import com.furkansogutma.app.feature.order.domain.repository.OrderRepository
import com.furkansogutma.app.feature.product.domain.repository.ProductRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class DataModule {
    @Binds @Singleton abstract fun auth(impl: AuthRepositoryImpl): AuthRepository
    @Binds @Singleton abstract fun products(impl: ProductRepositoryImpl): ProductRepository
    @Binds @Singleton abstract fun categories(impl: CategoryRepositoryImpl): CategoryRepository
    @Binds @Singleton abstract fun cart(impl: CartRepositoryImpl): CartRepository
    @Binds @Singleton abstract fun favorites(impl: FavoriteRepositoryImpl): FavoriteRepository
    @Binds @Singleton abstract fun orders(impl: OrderRepositoryImpl): OrderRepository
    @Binds @Singleton abstract fun account(impl: AccountRepositoryImpl): AccountRepository
    @Binds @Singleton abstract fun notifications(impl: NotificationRepositoryImpl): NotificationRepository
}
