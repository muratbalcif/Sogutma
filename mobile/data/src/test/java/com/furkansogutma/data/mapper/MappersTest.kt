package com.furkansogutma.data.mapper

import com.furkansogutma.core.network.dto.BrandDto
import com.furkansogutma.core.network.dto.CategoryDto
import com.furkansogutma.core.network.dto.MoneyDto
import com.furkansogutma.core.network.dto.ProductDto
import com.furkansogutma.core.network.dto.StockDto
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class MappersTest {
    @Test
    fun `product dto maps resolved price without recalculation`() {
        val dto = ProductDto(
            id = "1",
            sku = "SKU-1",
            name = "Kompresör",
            slug = "kompresor",
            brand = BrandDto("b", "Marka", "marka"),
            category = CategoryDto("c", "Kat", "kat"),
            price = MoneyDto("1999.90", "TRY", "CAMPAIGN"),
            compareAtPrice = MoneyDto("2499.90", "TRY", "RETAIL"),
            stock = StockDto(true, 5),
            onCampaign = true,
        )
        val domain = dto.toDomain()
        assertThat(domain.price?.amount).isEqualTo("1999.90")
        assertThat(domain.compareAtPrice?.amount).isEqualTo("2499.90")
        assertThat(domain.onCampaign).isTrue()
    }
}
