package com.furkansogutma.app.feature.product.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import javax.inject.Inject
import com.furkansogutma.app.feature.product.domain.model.ProductPage
import com.furkansogutma.app.feature.product.domain.model.ProductQuery
import com.furkansogutma.app.feature.product.domain.repository.ProductRepository

class GetProductsUseCase @Inject constructor(
    private val repository: ProductRepository,
) {
    suspend operator fun invoke(query: ProductQuery): Result<ProductPage> = repository.getProducts(query)
}
