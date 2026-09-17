package com.furkansogutma.domain.product

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class GetProductUseCase @Inject constructor(
    private val repository: ProductRepository,
) {
    suspend operator fun invoke(slug: String): Result<Product> = repository.getProductBySlug(slug)
}
