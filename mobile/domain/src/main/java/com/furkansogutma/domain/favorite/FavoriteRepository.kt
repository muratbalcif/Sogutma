package com.furkansogutma.domain.favorite

import com.furkansogutma.core.common.result.Result
import com.furkansogutma.domain.product.Product

interface FavoriteRepository {
    suspend fun getFavorites(): Result<List<Product>>
    suspend fun addFavorite(productId: String): Result<Unit>
    suspend fun removeFavorite(productId: String): Result<Unit>
}
