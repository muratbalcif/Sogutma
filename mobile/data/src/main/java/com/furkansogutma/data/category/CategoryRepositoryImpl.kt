package com.furkansogutma.data.category

import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.network.api.CatalogApi
import com.furkansogutma.data.mapper.toDomain
import com.furkansogutma.data.remote.SafeApiCall
import com.furkansogutma.domain.category.Category
import com.furkansogutma.domain.category.CategoryRepository
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
