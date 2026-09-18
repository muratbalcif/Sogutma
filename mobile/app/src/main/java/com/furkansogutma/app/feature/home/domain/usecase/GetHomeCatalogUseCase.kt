package com.furkansogutma.app.feature.home.domain.usecase

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.category.domain.model.Category
import com.furkansogutma.app.feature.category.domain.repository.CategoryRepository
import javax.inject.Inject
import com.furkansogutma.app.feature.product.domain.model.Banner
import com.furkansogutma.app.feature.product.domain.model.Brand
import com.furkansogutma.app.feature.product.domain.model.Product
import com.furkansogutma.app.feature.product.domain.repository.ProductRepository

data class HomeCatalog(
    val banners: List<Banner>,
    val categories: List<Category>,
    val featured: List<Product>,
    val campaigns: List<Product>,
    val bestSelling: List<Product>,
    val brands: List<Brand>,
    val sectionErrors: List<String> = emptyList(),
)

class GetHomeCatalogUseCase @Inject constructor(
    private val products: ProductRepository,
    private val categories: CategoryRepository,
) {
    suspend operator fun invoke(): Result<HomeCatalog> {
        val banners = products.getBanners()
        val cats = categories.getCategories()
        val featured = products.getFeatured()
        val campaigns = products.getCampaignProducts()
        val best = products.getBestSelling()
        val brands = products.getBrands()

        fun <T> Result<T>.orEmpty(empty: T, label: String, errors: MutableList<String>): T =
            when (this) {
                is Result.Success -> data
                is Result.Error -> {
                    errors += "$label: ${error.message}"
                    empty
                }
            }

        val errors = mutableListOf<String>()
        val catalog = HomeCatalog(
            banners = banners.orEmpty(emptyList(), "Banner", errors),
            categories = cats.orEmpty(emptyList(), "Kategoriler", errors),
            featured = featured.orEmpty(emptyList(), "Öne çıkanlar", errors),
            campaigns = campaigns.orEmpty(emptyList(), "Kampanyalar", errors),
            bestSelling = best.orEmpty(emptyList(), "Çok satanlar", errors),
            brands = brands.orEmpty(emptyList(), "Markalar", errors),
            sectionErrors = errors,
        )
        val allFailed = listOf(banners, cats, featured, campaigns, best, brands).all { it is Result.Error }
        return if (allFailed) {
            (banners as Result.Error)
        } else {
            Result.Success(catalog)
        }
    }
}
