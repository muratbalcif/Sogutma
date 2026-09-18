package com.furkansogutma.app.feature.search.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import javax.inject.Inject
import com.furkansogutma.app.feature.product.domain.model.ProductPage
import com.furkansogutma.app.feature.product.domain.repository.ProductRepository

class SearchProductsUseCase @Inject constructor(
    private val repository: ProductRepository,
) {
    suspend operator fun invoke(q: String, page: Int = 1): Result<ProductPage> =
        repository.searchProducts(q, page)
}
