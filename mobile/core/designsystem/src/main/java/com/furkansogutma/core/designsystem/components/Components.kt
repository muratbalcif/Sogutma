package com.furkansogutma.core.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import com.furkansogutma.core.common.money.MoneyFormatter
import com.furkansogutma.core.designsystem.theme.BadgeRed
import com.furkansogutma.core.designsystem.theme.ButtonShape
import com.furkansogutma.core.designsystem.theme.FurkanSogutmaTheme
import com.furkansogutma.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.core.designsystem.theme.OnSurfaceFaint
import com.furkansogutma.core.designsystem.theme.PillShape
import com.furkansogutma.core.designsystem.theme.PrimaryLight
import com.furkansogutma.core.designsystem.theme.White

@Composable
fun FurkanButton(
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        shape = ButtonShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ),
        modifier = modifier
            .height(50.dp)
            .semantics { contentDescription = text },
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary,
            )
            Spacer(Modifier.width(FurkanSpacing.xs))
        }
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun FurkanOutlinedButton(
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: ImageVector? = null,
    onClick: () -> Unit,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = ButtonShape,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = MaterialTheme.colorScheme.onSurface,
        ),
        modifier = modifier
            .height(48.dp)
            .semantics { contentDescription = text },
    ) {
        if (leadingIcon != null) {
            Icon(leadingIcon, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(FurkanSpacing.xs))
        }
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun FurkanAddToCartButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    label: String = "Sepete Ekle",
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = ButtonShape,
        contentPadding = PaddingValues(horizontal = FurkanSpacing.md, vertical = FurkanSpacing.xs),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ),
        modifier = modifier
            .fillMaxWidth()
            .height(44.dp)
            .semantics { contentDescription = label },
    ) {
        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(FurkanSpacing.xxs))
        Text(label, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun FurkanTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    isError: Boolean = false,
    supportingText: String? = null,
    isPassword: Boolean = false,
    passwordVisible: Boolean = false,
    onTogglePassword: (() -> Unit)? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    enabled: Boolean = true,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = FurkanSpacing.xxs),
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            enabled = enabled,
            isError = isError,
            supportingText = supportingText?.let { { Text(it) } },
            shape = MaterialTheme.shapes.small,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                focusedContainerColor = White,
                unfocusedContainerColor = White,
                disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            ),
            visualTransformation = if (isPassword && !passwordVisible) {
                PasswordVisualTransformation()
            } else {
                VisualTransformation.None
            },
            trailingIcon = if (isPassword && onTogglePassword != null) {
                {
                    IconButton(
                        onClick = onTogglePassword,
                        modifier = Modifier.semantics {
                            contentDescription = if (passwordVisible) "Şifreyi gizle" else "Şifreyi göster"
                        },
                    ) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = null,
                        )
                    }
                }
            } else {
                null
            },
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboardType),
        )
    }
}

@Composable
fun FurkanSearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Ürün, marka veya SKU ara",
) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier
            .fillMaxWidth()
            .height(54.dp)
            .semantics { contentDescription = "Arama" },
        singleLine = true,
        shape = MaterialTheme.shapes.medium,
        placeholder = {
            Text(
                placeholder,
                color = OnSurfaceFaint,
                style = MaterialTheme.typography.bodyMedium,
            )
        },
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
            cursorColor = MaterialTheme.colorScheme.primary,
        ),
    )
}

@Composable
fun FurkanPrice(
    amount: String,
    compareAt: String? = null,
    modifier: Modifier = Modifier,
    specialLabel: String = "Size Özel KDV Dahil",
    retailLabel: String = "Perakende KDV Dahil",
) {
    Column(modifier = modifier) {
        if (!compareAt.isNullOrBlank() && compareAt != amount) {
            Text(
                text = retailLabel,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = MoneyFormatter.formatTry(compareAt),
                style = MaterialTheme.typography.bodySmall,
                textDecoration = TextDecoration.LineThrough,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = specialLabel,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.secondary,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = MoneyFormatter.formatTry(amount),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.secondary,
            )
        } else {
            Text(
                text = "Fiyat KDV Dahil",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = MoneyFormatter.formatTry(amount),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
fun FurkanBadge(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        modifier = modifier
            .clip(PillShape)
            .background(MaterialTheme.colorScheme.secondary)
            .padding(horizontal = FurkanSpacing.xs, vertical = FurkanSpacing.xxs),
        color = MaterialTheme.colorScheme.onSecondary,
        style = MaterialTheme.typography.labelSmall,
    )
}

@Composable
fun FurkanFilterChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val bg = if (selected) MaterialTheme.colorScheme.secondary else White
    val fg = if (selected) MaterialTheme.colorScheme.onSecondary else MaterialTheme.colorScheme.onSurface
    val border = if (selected) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.outlineVariant
    Text(
        text = label,
        modifier = modifier
            .clip(PillShape)
            .border(1.dp, border, PillShape)
            .background(bg)
            .clickable(onClick = onClick)
            .padding(horizontal = FurkanSpacing.md, vertical = FurkanSpacing.xs)
            .semantics { contentDescription = label },
        color = fg,
        style = MaterialTheme.typography.labelMedium,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
fun FurkanLoading(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(
            modifier = Modifier.semantics { contentDescription = "Yükleniyor" },
            color = MaterialTheme.colorScheme.primary,
        )
    }
}

@Composable
fun FurkanError(
    message: String,
    modifier: Modifier = Modifier,
    onRetry: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(FurkanSpacing.xl),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(message, style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center)
        if (onRetry != null) {
            Spacer(Modifier.height(FurkanSpacing.md))
            FurkanButton(text = "Tekrar dene", onClick = onRetry)
        }
    }
}

@Composable
fun FurkanEmptyState(
    title: String,
    message: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Outlined.Inventory2,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(FurkanSpacing.xl),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(88.dp)
                .clip(CircleShape)
                .background(PrimaryLight),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(36.dp),
                tint = MaterialTheme.colorScheme.primary,
            )
        }
        Spacer(Modifier.height(FurkanSpacing.md))
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold,
        )
        if (message.isNotBlank()) {
            Spacer(Modifier.height(FurkanSpacing.xs))
            Text(
                message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(FurkanSpacing.md))
            FurkanButton(
                text = actionLabel,
                onClick = onAction,
                modifier = Modifier.fillMaxWidth(0.7f),
            )
        }
    }
}

@Composable
fun FurkanSkeletonBox(modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceVariant),
    )
}

@Composable
fun FurkanHomeSkeleton() {
    Column(Modifier.padding(FurkanSpacing.md), verticalArrangement = Arrangement.spacedBy(FurkanSpacing.md)) {
        FurkanSkeletonBox(Modifier.fillMaxWidth().height(160.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
            repeat(4) {
                FurkanSkeletonBox(Modifier.size(72.dp).clip(CircleShape))
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(FurkanSpacing.sm)) {
            repeat(2) {
                FurkanSkeletonBox(Modifier.width(160.dp).height(220.dp))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FurkanTopBar(
    title: String,
    onBack: (() -> Unit)? = null,
    actions: @Composable () -> Unit = {},
) {
    TopAppBar(
        title = {
            Text(
                title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth(),
                textAlign = if (onBack != null) TextAlign.Center else TextAlign.Start,
            )
        },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Geri" }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                }
            }
        },
        actions = { actions() },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = White,
            titleContentColor = MaterialTheme.colorScheme.onSurface,
        ),
    )
}

@Composable
fun FurkanCartIconButton(
    count: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    IconButton(onClick = onClick, modifier = modifier.semantics { contentDescription = "Sepet" }) {
        BadgedBox(
            badge = {
                if (count > 0) {
                    Badge(containerColor = BadgeRed) {
                        Text(if (count > 99) "99+" else count.toString())
                    }
                }
            },
        ) {
            Icon(Icons.Default.ShoppingCart, contentDescription = null)
        }
    }
}

@Composable
fun FurkanFavoriteIcon(
    isFavorite: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    IconButton(
        onClick = onClick,
        modifier = modifier.semantics {
            contentDescription = if (isFavorite) "Favorilerden çıkar" else "Favorilere ekle"
        },
    ) {
        Icon(
            imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
            contentDescription = null,
            tint = if (isFavorite) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
        )
    }
}

@Composable
fun FurkanQtyStepper(
    quantity: Int,
    onDecrement: () -> Unit,
    onIncrement: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .clip(PillShape)
            .border(1.dp, MaterialTheme.colorScheme.outline, PillShape)
            .padding(horizontal = FurkanSpacing.xxs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onDecrement, modifier = Modifier.semantics { contentDescription = "Azalt" }) {
            Icon(Icons.Default.Remove, contentDescription = null)
        }
        Text("$quantity", style = MaterialTheme.typography.titleMedium)
        IconButton(onClick = onIncrement, modifier = Modifier.semantics { contentDescription = "Artır" }) {
            Icon(Icons.Default.Add, contentDescription = null)
        }
    }
}

@Composable
fun FurkanStickyBottomBar(content: @Composable () -> Unit) {
    Surface(tonalElevation = 0.dp, shadowElevation = 12.dp, color = White) {
        Box(Modifier.fillMaxWidth().padding(FurkanSpacing.md)) { content() }
    }
}

@Composable
fun FurkanCheckoutStepper(currentStep: Int, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth().padding(vertical = FurkanSpacing.sm),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        listOf("Adres", "Ödeme", "Onay").forEachIndexed { index, label ->
            val step = index + 1
            val selected = step == currentStep
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(
                            if (step <= currentStep) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.surfaceVariant,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "$step",
                        color = if (step <= currentStep) MaterialTheme.colorScheme.onPrimary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
                Text(
                    label,
                    style = MaterialTheme.typography.labelMedium,
                    color = if (selected) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
fun FurkanNetworkImage(
    url: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Fit,
) {
    SubcomposeAsyncImage(
        model = url,
        contentDescription = contentDescription,
        modifier = modifier.background(White),
        contentScale = contentScale,
        loading = { FurkanSkeletonBox(Modifier.fillMaxSize()) },
        error = {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Image, contentDescription = null, tint = OnSurfaceFaint)
            }
        },
    )
}

@Composable
fun FurkanMenuRow(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .border(1.dp, MaterialTheme.colorScheme.outline, MaterialTheme.shapes.medium)
            .background(White)
            .clickable(onClick = onClick)
            .padding(horizontal = FurkanSpacing.md, vertical = FurkanSpacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(
                icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(22.dp),
            )
            Spacer(Modifier.width(FurkanSpacing.sm))
        }
        Text(
            title,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f),
        )
        if (trailing != null) {
            trailing()
        } else {
            Text("›", style = MaterialTheme.typography.titleLarge, color = OnSurfaceFaint)
        }
    }
}

@Composable
fun FurkanCategoryTile(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val label = title.trim().ifBlank { "Kategori" }
    Row(
        modifier = modifier
            .height(72.dp)
            .shadow(4.dp, MaterialTheme.shapes.medium, clip = false)
            .clip(MaterialTheme.shapes.medium)
            .background(White)
            .clickable(onClick = onClick)
            .padding(horizontal = FurkanSpacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(PrimaryLight),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                label.take(1).uppercase(),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        Spacer(Modifier.width(FurkanSpacing.sm))
        Text(
            text = label,
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.weight(1f),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}

@Composable
fun FurkanProductCard(
    name: String,
    brand: String,
    imageUrl: String?,
    price: String?,
    compareAt: String?,
    onCampaign: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    stockLabel: String? = null,
    sku: String? = null,
    isFavorite: Boolean = false,
    onFavoriteClick: (() -> Unit)? = null,
    onAddToCart: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .shadow(6.dp, MaterialTheme.shapes.medium, clip = false)
            .clip(MaterialTheme.shapes.medium)
            .background(White)
            .clickable(onClick = onClick)
            .padding(FurkanSpacing.sm)
            .semantics { contentDescription = name },
    ) {
        Box {
            FurkanNetworkImage(
                url = imageUrl,
                contentDescription = name,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .clip(MaterialTheme.shapes.small)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
            )
            if (onCampaign) {
                FurkanBadge(
                    text = "Kampanya",
                    modifier = Modifier.align(Alignment.TopStart).padding(FurkanSpacing.xs),
                )
            }
            if (onFavoriteClick != null) {
                Surface(
                    shape = CircleShape,
                    color = White.copy(alpha = 0.95f),
                    shadowElevation = 2.dp,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(FurkanSpacing.xs),
                ) {
                    FurkanFavoriteIcon(
                        isFavorite = isFavorite,
                        onClick = onFavoriteClick,
                    )
                }
            }
        }
        Spacer(Modifier.height(FurkanSpacing.xs))
        if (brand.isNotBlank()) {
            Text(
                brand,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Text(
            name,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            color = MaterialTheme.colorScheme.onSurface,
            minLines = 2,
        )
        if (!stockLabel.isNullOrBlank()) {
            Text(
                stockLabel,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.error,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        } else if (!sku.isNullOrBlank()) {
            Text(
                "SKU $sku",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.height(FurkanSpacing.xxs))
        if (price != null) {
            FurkanPrice(amount = price, compareAt = compareAt)
        }
        if (onAddToCart != null) {
            Spacer(Modifier.height(FurkanSpacing.xs))
            FurkanAddToCartButton(onClick = onAddToCart)
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun FurkanProductCardPreview() {
    FurkanSogutmaTheme {
        FurkanProductCard(
            name = "Unico Drenaj Rezistansı 1,5 mt",
            brand = "Unico",
            imageUrl = null,
            price = "199.90",
            compareAt = "249.90",
            onCampaign = true,
            onClick = {},
            sku = "BZDMAL6370",
            onAddToCart = {},
            modifier = Modifier.width(180.dp),
        )
    }
}
