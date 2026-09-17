package com.furkansogutma.domain.category

import com.furkansogutma.core.common.result.Result

interface CategoryRepository {
    suspend fun getCategories(): Result<List<Category>>
    suspend fun getCategoryBySlug(slug: String): Result<Category>
}
