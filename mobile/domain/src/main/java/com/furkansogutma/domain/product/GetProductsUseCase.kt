package com.furkansogutma.domain.product

import com.furkansogutma.core.common.result.Result
import javax.inject.Inject

class GetProductsUseCase @Inject constructor(
    private val repository: ProductRepository,
) {
    suspend operator fun invoke(query: ProductQuery): Result<ProductPage> = repository.getProducts(query)
}
