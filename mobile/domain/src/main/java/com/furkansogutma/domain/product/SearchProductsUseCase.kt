package com.furkansogutma.domain.product

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class SearchProductsUseCase @Inject constructor(
    private val repository: ProductRepository,
) {
    suspend operator fun invoke(q: String, page: Int = 1): Result<ProductPage> =
        repository.searchProducts(q, page)
}
