package com.furkansogutma.data.di

import com.furkansogutma.data.account.AccountRepositoryImpl
import com.furkansogutma.data.auth.AuthRepositoryImpl
import com.furkansogutma.data.cart.CartRepositoryImpl
import com.furkansogutma.data.category.CategoryRepositoryImpl
import com.furkansogutma.data.favorite.FavoriteRepositoryImpl
import com.furkansogutma.data.notification.NotificationRepositoryImpl
import com.furkansogutma.data.order.OrderRepositoryImpl
import com.furkansogutma.data.product.ProductRepositoryImpl
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.auth.AuthRepository
import com.furkansogutma.domain.cart.CartRepository
import com.furkansogutma.domain.category.CategoryRepository
import com.furkansogutma.domain.favorite.FavoriteRepository
import com.furkansogutma.domain.notification.NotificationRepository
import com.furkansogutma.domain.order.OrderRepository
import com.furkansogutma.domain.product.ProductRepository
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
