package com.furkansogutma.app.feature.home.presentation

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyItemScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AcUnit
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Kitchen
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.furkansogutma.app.R
import com.furkansogutma.app.core.designsystem.components.FurkanNetworkImage
import com.furkansogutma.app.core.designsystem.components.FurkanProductCard
import com.furkansogutma.app.core.designsystem.theme.Accent
import com.furkansogutma.app.core.designsystem.theme.AccentSoft
import com.furkansogutma.app.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.app.core.designsystem.theme.OnSurface
import com.furkansogutma.app.core.designsystem.theme.OnSurfaceMuted
import com.furkansogutma.app.core.designsystem.theme.Outline
import com.furkansogutma.app.core.designsystem.theme.Primary
import com.furkansogutma.app.core.designsystem.theme.PrimaryDark
import com.furkansogutma.app.core.designsystem.theme.PrimaryLight
import com.furkansogutma.app.core.designsystem.theme.Surface
import com.furkansogutma.app.core.designsystem.theme.White
import com.furkansogutma.app.feature.category.domain.model.Category
import com.furkansogutma.app.feature.product.domain.model.Banner
import com.furkansogutma.app.feature.product.domain.model.Brand
import com.furkansogutma.app.feature.product.domain.model.Product

private val CardShape = RoundedCornerShape(20.dp)
private val SearchShape = RoundedCornerShape(18.dp)

@Composable
internal fun HomeHeader(
    greeting: String,
    cartCount: Int,
    onCartClick: () -> Unit,
    onSearchClick: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(FurkanSpacing.md)) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Image(
                    painter = painterResource(R.drawable.ic_logo),
                    contentDescription = "FurkanSoğutma",
                    modifier = Modifier.height(112.dp),
                    contentScale = ContentScale.Fit,
                )
                Spacer(Modifier.height(FurkanSpacing.xxs))
                Text(
                    if (greeting.contains("👋")) greeting else "$greeting 👋",
                    style = MaterialTheme.typography.bodyLarge,
                    color = OnSurfaceMuted,
                )
            }
            HomeCartButton(count = cartCount, onClick = onCartClick)
        }
        HomeSearchBar(onClick = onSearchClick)
    }
}

@Composable
private fun HomeCartButton(count: Int, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(CircleShape)
            .background(Surface)
            .border(1.dp, Outline, CircleShape)
            .clickable(onClick = onClick)
            .semantics { contentDescription = "Sepet" },
        contentAlignment = Alignment.Center,
    ) {
        BadgedBox(
            badge = {
                if (count > 0) {
                    Badge(containerColor = Accent) {
                        Text(if (count > 99) "99+" else count.toString())
                    }
                }
            },
        ) {
            Icon(
                Icons.Outlined.ShoppingCart,
                contentDescription = null,
                tint = Primary,
            )
        }
    }
}

@Composable
private fun HomeSearchBar(onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(58.dp)
            .shadow(2.dp, SearchShape, clip = false)
            .clip(SearchShape)
            .background(White)
            .border(1.dp, Outline, SearchShape)
            .clickable(onClick = onClick)
            .padding(horizontal = FurkanSpacing.md)
            .semantics { contentDescription = "Arama" },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.Search, contentDescription = null, tint = OnSurfaceMuted)
        Spacer(Modifier.width(FurkanSpacing.sm))
        Text(
            "Ürün, marka veya SKU ara...",
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.bodyLarge,
            color = OnSurfaceMuted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Icon(
            Icons.Outlined.QrCodeScanner,
            contentDescription = "Barkod ara",
            tint = Primary,
        )
    }
}

@Composable
internal fun HomeHero(
    banners: List<Banner>,
    onBrowse: () -> Unit,
    onProductClick: (String) -> Unit,
    onCategoryClick: (String) -> Unit,
    onCampaigns: () -> Unit,
) {
    if (banners.isEmpty()) {
        PromoHero(
            title = "Klima Ürünlerinde\nÖzel Fırsatlar",
            subtitle = "Eviniz ve iş yeriniz için güvenilir soğutma çözümleri",
            cta = "Ürünleri İncele →",
            onClick = onBrowse,
        )
        return
    }
    val pager = rememberPagerState { banners.size }
    HorizontalPager(
        state = pager,
        pageSpacing = FurkanSpacing.sm,
    ) { page ->
        val banner = banners[page]
        PromoHero(
            title = banner.title.ifBlank { "Klimanı Yaza Hazırla" },
            subtitle = banner.subtitle ?: "Eviniz ve iş yeriniz için güvenilir soğutma çözümleri",
            cta = "İncele →",
            imageUrl = banner.imageUrl,
            onClick = {
                val value = banner.linkValue
                when (banner.linkType.uppercase()) {
                    "PRODUCT" -> if (!value.isNullOrBlank()) onProductClick(value) else onBrowse()
                    "CATEGORY" -> if (!value.isNullOrBlank()) onCategoryClick(value) else onBrowse()
                    "CAMPAIGN" -> onCampaigns()
                    else -> onBrowse()
                }
            },
        )
    }
}

@Composable
private fun PromoHero(
    title: String,
    subtitle: String,
    cta: String,
    onClick: () -> Unit,
    imageUrl: String? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(176.dp)
            .shadow(3.dp, CardShape, clip = false)
            .clip(CardShape)
            .background(
                Brush.linearGradient(
                    listOf(PrimaryLight, Color(0xFFE7F6F4), White),
                ),
            )
            .clickable(onClick = onClick)
            .padding(FurkanSpacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1.15f).fillMaxHeight(), verticalArrangement = Arrangement.Center) {
            Text(
                title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = PrimaryDark,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(FurkanSpacing.xs))
            Text(
                subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = OnSurfaceMuted,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(FurkanSpacing.sm))
            Text(
                cta,
                style = MaterialTheme.typography.labelLarge,
                color = Primary,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Spacer(Modifier.width(FurkanSpacing.sm))
        Box(
            modifier = Modifier
                .weight(0.85f)
                .fillMaxHeight()
                .clip(RoundedCornerShape(16.dp))
                .background(White.copy(alpha = 0.55f)),
            contentAlignment = Alignment.Center,
        ) {
            if (imageUrl.isNullOrBlank()) {
                Icon(
                    Icons.Outlined.AcUnit,
                    contentDescription = null,
                    tint = Primary,
                    modifier = Modifier.size(56.dp),
                )
            } else {
                FurkanNetworkImage(
                    url = imageUrl,
                    contentDescription = title,
                    modifier = Modifier.fillMaxWidth().fillMaxHeight(),
                    contentScale = ContentScale.Crop,
                )
            }
        }
    }
}

@Composable
internal fun HomeCategorySection(
    categories: List<Category>,
    onCategoryClick: (String) -> Unit,
    onSeeAll: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
        SectionTitle("Kategoriler", onSeeAll)
        if (categories.isEmpty()) {
            HomeEmptyCard(
                title = "Kategori yok",
                message = "Kategoriler şu an listelenemiyor.",
            )
            return
        }
        LazyRow(
            contentPadding = PaddingValues(0.dp),
            horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm),
        ) {
            items(categories, key = { it.id }) { category ->
                CategoryCard(category, onClick = { onCategoryClick(category.slug) })
            }
        }
    }
}

@Composable
private fun CategoryCard(category: Category, onClick: () -> Unit) {
    val label = category.name.trim().ifBlank { category.slug }
    val style = categoryStyle(label, category.slug)
    Column(
        modifier = Modifier
            .width(128.dp)
            .height(156.dp)
            .shadow(2.dp, CardShape, clip = false)
            .clip(CardShape)
            .background(White)
            .border(1.dp, Outline, CardShape)
            .clickable(onClick = onClick)
            .padding(FurkanSpacing.sm),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(76.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(style.background),
            contentAlignment = Alignment.Center,
        ) {
            if (!category.image.isNullOrBlank()) {
                FurkanNetworkImage(
                    url = category.image,
                    contentDescription = label,
                    modifier = Modifier.size(76.dp),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Icon(style.icon, contentDescription = label, tint = style.tint, modifier = Modifier.size(32.dp))
            }
        }
        Spacer(Modifier.height(FurkanSpacing.sm))
        Text(
            label,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = OnSurface,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
internal fun HomeProductSection(
    title: String,
    products: List<Product>,
    onProductClick: (String) -> Unit,
    onSeeAll: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
        SectionTitle(title, onSeeAll)
        if (products.isEmpty()) {
            HomeEmptyCard(
                title = "Henüz ürün yok",
                message = "Bu bölümde henüz ürün bulunmuyor.",
            )
        } else {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
                items(products, key = { it.id }) { product ->
                    FurkanProductCard(
                        name = product.name,
                        brand = product.brandName,
                        imageUrl = product.images.firstOrNull()?.url,
                        price = product.price?.amount,
                        compareAt = product.compareAtPrice?.amount,
                        onCampaign = product.onCampaign,
                        sku = product.sku,
                        stockLabel = if (product.stockAvailable) null else "Stok yok",
                        onClick = { onProductClick(product.slug) },
                        modifier = Modifier.width(208.dp),
                    )
                }
            }
        }
    }
}

@Composable
internal fun HomeCampaignSection(
    products: List<Product>,
    onProductClick: (String) -> Unit,
    onSeeAll: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
        SectionTitle("Kampanyalar", onSeeAll)
        if (products.isEmpty()) {
            HomeEmptyCard(
                title = "Henüz ürün yok",
                message = "Bu bölümde henüz ürün bulunmuyor.",
            )
        } else {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
                items(products, key = { it.id }) { product ->
                    CampaignCard(
                        product = product,
                        onClick = { onProductClick(product.slug) },
                        modifier = Modifier.fillParentMaxWidth(0.92f),
                    )
                }
            }
        }
    }
}

@Composable
private fun LazyItemScope.CampaignCard(
    product: Product,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .height(176.dp)
            .shadow(2.dp, CardShape, clip = false)
            .clip(CardShape)
            .background(White)
            .border(1.dp, Outline, CardShape)
            .clickable(onClick = onClick)
            .padding(FurkanSpacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1.1f)) {
            Text(
                product.name,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = OnSurface,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (product.brandName.isNotBlank()) {
                Spacer(Modifier.height(FurkanSpacing.xxs))
                Text(
                    product.brandName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = OnSurfaceMuted,
                    maxLines = 1,
                )
            }
            Spacer(Modifier.height(FurkanSpacing.sm))
            Text(
                "İncele →",
                color = Primary,
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.labelLarge,
            )
        }
        Spacer(Modifier.width(FurkanSpacing.sm))
        FurkanNetworkImage(
            url = product.images.firstOrNull()?.url,
            contentDescription = product.name,
            modifier = Modifier
                .width(108.dp)
                .height(132.dp)
                .clip(RoundedCornerShape(16.dp)),
            contentScale = ContentScale.Crop,
        )
    }
}

@Composable
internal fun HomeBrandSection(brands: List<Brand>) {
    Column(verticalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
        SectionTitle("Markalar", onSeeAll = null)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.xs)) {
            items(brands, key = { it.id }) { brand ->
                val label = brand.name.trim().ifBlank { brand.slug }
                Row(
                    modifier = Modifier
                        .height(48.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(White)
                        .border(1.dp, Outline, RoundedCornerShape(16.dp))
                        .padding(horizontal = FurkanSpacing.md),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (!brand.logo.isNullOrBlank()) {
                        FurkanNetworkImage(
                            url = brand.logo,
                            contentDescription = label,
                            modifier = Modifier.size(24.dp).clip(CircleShape),
                        )
                        Spacer(Modifier.width(FurkanSpacing.xs))
                    }
                    Text(
                        label,
                        style = MaterialTheme.typography.titleSmall,
                        color = OnSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(title: String, onSeeAll: (() -> Unit)?) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            title,
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = OnSurface,
        )
        if (onSeeAll != null) {
            TextButton(onClick = onSeeAll) {
                Text("Tümü →", color = Primary, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun HomeEmptyCard(title: String, message: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(White)
            .border(1.dp, Outline, CardShape)
            .padding(horizontal = FurkanSpacing.md, vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(PrimaryLight),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Outlined.Inventory2,
                contentDescription = null,
                tint = Primary,
                modifier = Modifier.size(26.dp),
            )
        }
        Spacer(Modifier.height(FurkanSpacing.sm))
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = OnSurface,
        )
        Spacer(Modifier.height(FurkanSpacing.xxs))
        Text(
            message,
            style = MaterialTheme.typography.bodyMedium,
            color = OnSurfaceMuted,
        )
    }
}

private data class CategoryVisual(
    val icon: ImageVector,
    val tint: Color,
    val background: Color,
)

private fun categoryStyle(name: String, slug: String): CategoryVisual {
    val key = "$name $slug".lowercase()
    return when {
        key.contains("buzdolab") -> CategoryVisual(Icons.Outlined.Kitchen, Accent, AccentSoft)
        key.contains("yedek") || key.contains("parca") || key.contains("parça") ->
            CategoryVisual(Icons.Outlined.Settings, Color(0xFF6D5BD0), Color(0xFFEDE9FE))
        key.contains("servis") -> CategoryVisual(Icons.Outlined.Build, Color(0xFFD4564E), Color(0xFFFDECEC))
        key.contains("sogut") || key.contains("soğut") || key.contains("fan") ->
            CategoryVisual(Icons.Outlined.AcUnit, Color(0xFFC47B12), Color(0xFFFFF4E0))
        key.contains("klima") -> CategoryVisual(Icons.Outlined.AcUnit, Primary, PrimaryLight)
        else -> {
            val palette = listOf(
                CategoryVisual(Icons.Outlined.AcUnit, Primary, PrimaryLight),
                CategoryVisual(Icons.Outlined.Kitchen, Accent, AccentSoft),
                CategoryVisual(Icons.Outlined.Build, Color(0xFFC47B12), Color(0xFFFFF4E0)),
            )
            palette[kotlin.math.abs(key.hashCode()) % palette.size]
        }
    }
}
