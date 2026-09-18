package com.furkansogutma.app.feature.product.domain.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.product.domain.model.Banner
import com.furkansogutma.app.feature.product.domain.model.Brand
import com.furkansogutma.app.feature.product.domain.model.Campaign
import com.furkansogutma.app.feature.product.domain.model.CampaignProduct
import com.furkansogutma.app.feature.product.domain.model.Product
import com.furkansogutma.app.feature.product.domain.model.ProductPage
import com.furkansogutma.app.feature.product.domain.model.ProductQuery

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
    suspend fun getRelatedProducts(slug: String): Result<List<Product>>
    suspend fun getBanners(): Result<List<Banner>>
    suspend fun getBrands(): Result<List<Brand>>
}
