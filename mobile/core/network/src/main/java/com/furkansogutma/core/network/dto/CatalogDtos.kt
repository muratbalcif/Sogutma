package com.furkansogutma.core.network.dto


data class PaginatedDto<T>(
    val items: List<T>,
    val meta: PageMetaDto,
)

data class PageMetaDto(
    val page: Int,
    val limit: Int,
    val total: Int,
    val totalPages: Int,
)

data class MoneyDto(
    val amount: String,
    val currency: String,
    val type: String? = null,
)

data class ProductImageDto(
    val id: String,
    val url: String,
    val alt: String? = null,
    val sortOrder: Int = 0,
    val isPrimary: Boolean = false,
)

data class BrandDto(
    val id: String,
    val name: String,
    val slug: String,
    val logo: String? = null,
)

data class CategoryDto(
    val id: String,
    val name: String,
    val slug: String,
    val description: String? = null,
    val parentId: String? = null,
    val children: List<CategoryDto>? = null,
)

data class StockDto(
    val available: Boolean,
    val quantity: Int,
)

data class ProductDto(
    val id: String,
    val sku: String,
    val barcode: String? = null,
    val name: String,
    val slug: String,
    val description: String? = null,
    val brand: BrandDto,
    val category: CategoryDto,
    val images: List<ProductImageDto> = emptyList(),
    val price: MoneyDto? = null,
    val compareAtPrice: MoneyDto? = null,
    val stock: StockDto? = null,
    val onCampaign: Boolean? = null,
    val attributes: List<ProductAttributeDto>? = null,
    val compatibility: List<ProductCompatibilityDto>? = null,
)

data class ProductAttributeDto(
    val id: String,
    val name: String,
    val value: String,
    val sortOrder: Int = 0,
)

data class ProductCompatibilityDto(
    val id: String,
    val manufacturer: String,
    val model: String,
    val modelYear: Int? = null,
    val notes: String? = null,
)

data class BannerDto(
    val id: String,
    val title: String,
    val subtitle: String? = null,
    val imageUrl: String,
    val mobileImageUrl: String? = null,
    val linkType: String,
    val linkValue: String? = null,
    val sortOrder: Int = 0,
)
