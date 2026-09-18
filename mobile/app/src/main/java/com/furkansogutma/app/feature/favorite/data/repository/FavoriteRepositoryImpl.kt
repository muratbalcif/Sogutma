package com.furkansogutma.app.feature.favorite.data.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.core.network.api.CommerceApi
import com.furkansogutma.app.data.mapper.toDomain
import com.furkansogutma.app.core.network.SafeApiCall
import com.furkansogutma.app.feature.favorite.domain.repository.FavoriteRepository
import com.furkansogutma.app.feature.product.domain.model.Product
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FavoriteRepositoryImpl @Inject constructor(
    private val api: CommerceApi,
    private val safeApiCall: SafeApiCall,
) : FavoriteRepository {
    override suspend fun getFavorites(): Result<List<Product>> =
        safeApiCall { api.favorites().map { it.product.toDomain() } }
    override suspend fun addFavorite(productId: String): Result<Unit> =
        safeApiCall { api.addFavorite(productId); Unit }
    override suspend fun removeFavorite(productId: String): Result<Unit> =
        safeApiCall { api.removeFavorite(productId); Unit }
}
