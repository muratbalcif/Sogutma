package com.furkansogutma.app.feature.favorite.domain.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.product.domain.model.Product

interface FavoriteRepository {
    suspend fun getFavorites(): Result<List<Product>>
    suspend fun addFavorite(productId: String): Result<Unit>
    suspend fun removeFavorite(productId: String): Result<Unit>
}
