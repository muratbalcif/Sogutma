package com.furkansogutma.app.feature.category.data.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.core.network.api.CatalogApi
import com.furkansogutma.app.data.mapper.toDomain
import com.furkansogutma.app.core.network.SafeApiCall
import com.furkansogutma.app.feature.category.domain.model.Category
import com.furkansogutma.app.feature.category.domain.repository.CategoryRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CategoryRepositoryImpl @Inject constructor(
    private val api: CatalogApi,
    private val safeApiCall: SafeApiCall,
) : CategoryRepository {
    override suspend fun getCategories(): Result<List<Category>> =
        safeApiCall { api.categories().map { it.toDomain() } }

    override suspend fun getCategoryBySlug(slug: String): Result<Category> =
        safeApiCall { api.category(slug).toDomain() }
}
