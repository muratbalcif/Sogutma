package com.furkansogutma.data.favorite

import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.network.api.CommerceApi
import com.furkansogutma.data.mapper.toDomain
import com.furkansogutma.data.remote.SafeApiCall
import com.furkansogutma.domain.favorite.FavoriteRepository
import com.furkansogutma.domain.product.Product
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
