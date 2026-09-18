package com.furkansogutma.app.feature.product.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import javax.inject.Inject
import com.furkansogutma.app.feature.product.domain.model.Product
import com.furkansogutma.app.feature.product.domain.repository.ProductRepository

class GetProductUseCase @Inject constructor(
    private val repository: ProductRepository,
) {
    suspend operator fun invoke(slug: String): Result<Product> = repository.getProductBySlug(slug)
}
