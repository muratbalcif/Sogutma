package com.furkansogutma.core.network.api

import com.furkansogutma.core.network.dto.BannerDto
import com.furkansogutma.core.network.dto.BrandDto
import com.furkansogutma.core.network.dto.CampaignDto
import com.furkansogutma.core.network.dto.CampaignProductDto
import com.furkansogutma.core.network.dto.CategoryDto
import com.furkansogutma.core.network.dto.PaginatedDto
import com.furkansogutma.core.network.dto.ProductDto
import com.furkansogutma.core.network.dto.SiteConfigDto
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.QueryMap

interface CatalogApi {
    @GET("categories")
    suspend fun categories(): List<CategoryDto>

    @GET("categories/{slug}")
    suspend fun category(@Path("slug") slug: String): CategoryDto

    @GET("brands")
    suspend fun brands(): List<BrandDto>

    @GET("banners")
    suspend fun banners(): List<BannerDto>

    @GET("campaigns")
    suspend fun campaignList(): List<CampaignDto>

    @GET("campaigns/{slug}")
    suspend fun campaign(@Path("slug") slug: String): CampaignDto

    @GET("campaigns/{slug}/products")
    suspend fun campaignProducts(@Path("slug") slug: String): List<CampaignProductDto>

    @GET("products")
    suspend fun products(@QueryMap query: Map<String, String>): PaginatedDto<ProductDto>

    @GET("products/search")
    suspend fun search(
        @Query("q") q: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
    ): PaginatedDto<ProductDto>

    @GET("products/featured")
    suspend fun featured(): List<ProductDto>

    @GET("products/best-selling")
    suspend fun bestSelling(): List<ProductDto>

    @GET("products/campaigns")
    suspend fun campaigns(): List<ProductDto>

    @GET("products/{slug}")
    suspend fun product(@Path("slug") slug: String): ProductDto

    @GET("products/{slug}/related")
    suspend fun related(@Path("slug") slug: String): List<ProductDto>

    @GET("site/config")
    suspend fun siteConfig(): SiteConfigDto
}
