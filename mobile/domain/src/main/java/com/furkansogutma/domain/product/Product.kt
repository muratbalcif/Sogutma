package com.furkansogutma.domain.product

data class Money(
    val amount: String,
    val currency: String,
    val type: String? = null,
)

data class ProductImage(
    val id: String,
    val url: String,
    val alt: String?,
    val isPrimary: Boolean,
)

data class Product(
    val id: String,
    val sku: String,
    val barcode: String?,
    val name: String,
    val slug: String,
    val description: String?,
    val brandName: String,
    val brandSlug: String,
    val categoryName: String,
    val categorySlug: String,
    val images: List<ProductImage>,
    val price: Money?,
    val compareAtPrice: Money?,
    val stockAvailable: Boolean,
    val stockQuantity: Int,
    val onCampaign: Boolean,
    val attributes: List<ProductAttribute> = emptyList(),
    val compatibility: List<ProductCompatibility> = emptyList(),
    val technicalHtml: String? = null,
    val compatibilityHtml: String? = null,
)

data class ProductAttribute(val name: String, val value: String)
data class ProductCompatibility(
    val manufacturer: String,
    val model: String,
    val modelYear: Int?,
    val notes: String?,
)

data class ProductPage(
    val items: List<Product>,
    val page: Int,
    val totalPages: Int,
    val total: Int,
)

data class ProductQuery(
    val page: Int = 1,
    val limit: Int = 20,
    val category: String? = null,
    val brand: String? = null,
    val search: String? = null,
    val sort: String = "recommended",
    val minPrice: String? = null,
    val maxPrice: String? = null,
    val inStock: Boolean? = null,
    val onCampaign: Boolean? = null,
)

data class Banner(
    val id: String,
    val title: String,
    val subtitle: String?,
    val imageUrl: String,
    val linkType: String,
    val linkValue: String?,
)

data class Brand(
    val id: String,
    val name: String,
    val slug: String,
    val logo: String?,
)

data class Campaign(
    val id: String,
    val name: String,
    val slug: String,
    val description: String?,
    val type: String,
    val active: Boolean,
    val priority: Int,
    val startsAt: String,
    val endsAt: String,
    val status: String? = null,
)

data class CampaignProduct(
    val id: String,
    val productId: String,
    val name: String,
    val slug: String,
    val sku: String,
    val discountPercentage: String?,
    val discountAmount: String?,
    val specialPrice: String?,
)
