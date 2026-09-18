package com.furkansogutma.app.feature.category.domain.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.category.domain.model.Category

interface CategoryRepository {
    suspend fun getCategories(): Result<List<Category>>
    suspend fun getCategoryBySlug(slug: String): Result<Category>
}
