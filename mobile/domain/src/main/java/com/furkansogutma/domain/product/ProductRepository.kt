package com.furkansogutma.domain.product

import com.furkansogutma.core.common.result.Result

interface ProductRepository {
    suspend fun getProducts(query: ProductQuery): Result<ProductPage>
    suspend fun getProductBySlug(slug: String): Result<Product>
    suspend fun searchProducts(q: String, page: Int = 1): Result<ProductPage>
    suspend fun getFeatured(): Result<List<Product>>
    suspend fun getBestSelling(): Result<List<Product>>
    suspend fun getCampaignProducts(): Result<List<Product>>
    suspend fun getCampaigns(): Result<List<Campaign>>
    suspend fun getCampaignBySlug(slug: String): Result<Campaign>
    suspend fun getCampaignProductsBySlug(slug: String): Result<List<CampaignProduct>>
    suspend fun getBanners(): Result<List<Banner>>
    suspend fun getBrands(): Result<List<Brand>>
}
