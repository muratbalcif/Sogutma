package com.furkansogutma.data.product

import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.network.api.CatalogApi
import com.furkansogutma.data.mapper.toDomain
import com.furkansogutma.data.remote.SafeApiCall
import com.furkansogutma.domain.product.Banner
import com.furkansogutma.domain.product.Brand
import com.furkansogutma.domain.product.Campaign
import com.furkansogutma.domain.product.CampaignProduct
import com.furkansogutma.domain.product.Product
import com.furkansogutma.domain.product.ProductPage
import com.furkansogutma.domain.product.ProductQuery
import com.furkansogutma.domain.product.ProductRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProductRepositoryImpl @Inject constructor(
    private val api: CatalogApi,
    private val safeApiCall: SafeApiCall,
) : ProductRepository {

    override suspend fun getProducts(query: ProductQuery): Result<ProductPage> = safeApiCall {
        val map = buildMap {
            put("page", query.page.toString())
            put("limit", query.limit.toString())
            put("sort", query.sort)
            query.category?.let { put("category", it) }
            query.brand?.let { put("brand", it) }
            query.search?.let { put("search", it) }
            query.minPrice?.let { put("minPrice", it) }
            query.maxPrice?.let { put("maxPrice", it) }
            query.inStock?.let { put("inStock", it.toString()) }
            query.onCampaign?.let { put("onCampaign", it.toString()) }
        }
        val page = api.products(map)
        ProductPage(page.items.map { it.toDomain() }, page.meta.page, page.meta.totalPages, page.meta.total)
    }

    override suspend fun getProductBySlug(slug: String): Result<Product> =
        safeApiCall { api.product(slug).toDomain() }

    override suspend fun searchProducts(q: String, page: Int): Result<ProductPage> = safeApiCall {
        val result = api.search(q, page)
        ProductPage(result.items.map { it.toDomain() }, result.meta.page, result.meta.totalPages, result.meta.total)
    }

    override suspend fun getFeatured(): Result<List<Product>> =
        safeApiCall { api.featured().map { it.toDomain() } }

    override suspend fun getBestSelling(): Result<List<Product>> =
        safeApiCall { api.bestSelling().map { it.toDomain() } }

    override suspend fun getCampaignProducts(): Result<List<Product>> =
        safeApiCall { api.campaigns().map { it.toDomain() } }

    override suspend fun getCampaigns(): Result<List<Campaign>> =
        safeApiCall { api.campaignList().map { it.toDomain() } }

    override suspend fun getCampaignBySlug(slug: String): Result<Campaign> =
        safeApiCall { api.campaign(slug).toDomain() }

    override suspend fun getCampaignProductsBySlug(slug: String): Result<List<CampaignProduct>> =
        safeApiCall { api.campaignProducts(slug).map { it.toDomain() } }

    override suspend fun getRelatedProducts(slug: String): Result<List<Product>> =
        safeApiCall { api.related(slug).map { it.toDomain() } }

    override suspend fun getBanners(): Result<List<Banner>> =
        safeApiCall { api.banners().map { it.toDomain() } }

    override suspend fun getBrands(): Result<List<Brand>> =
        safeApiCall { api.brands().map { it.toDomain() } }
}
