package com.furkansogutma.core.designsystem.components

import androidx.compose.foundation.background
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
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.compose.SubcomposeAsyncImage
import com.furkansogutma.core.common.money.MoneyFormatter
import com.furkansogutma.core.designsystem.theme.FurkanSogutmaTheme
import com.furkansogutma.core.designsystem.theme.FurkanSpacing

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
        modifier = modifier
            .height(48.dp)
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
        Text(text)
    }
}

@Composable
fun FurkanOutlinedButton(
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .height(48.dp)
            .semantics { contentDescription = text },
    ) {
        Text(text)
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
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = modifier.fillMaxWidth(),
        singleLine = true,
        enabled = enabled,
        isError = isError,
        supportingText = supportingText?.let { { Text(it) } },
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
            .semantics { contentDescription = "Arama" },
        singleLine = true,
        placeholder = { Text(placeholder) },
    )
}

@Composable
fun FurkanPrice(
    amount: String,
    compareAt: String? = null,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier, verticalAlignment = Alignment.Bottom) {
        Text(
            text = MoneyFormatter.formatTry(amount),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.secondary,
        )
        if (!compareAt.isNullOrBlank() && compareAt != amount) {
            Spacer(Modifier.width(FurkanSpacing.xs))
            Text(
                text = MoneyFormatter.formatTry(compareAt),
                style = MaterialTheme.typography.bodyMedium,
                textDecoration = TextDecoration.LineThrough,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
fun FurkanBadge(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        modifier = modifier
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.primary)
            .padding(horizontal = FurkanSpacing.xs, vertical = FurkanSpacing.xxs),
        color = MaterialTheme.colorScheme.onPrimary,
        style = MaterialTheme.typography.labelLarge,
    )
}

@Composable
fun FurkanLoading(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(modifier = Modifier.semantics { contentDescription = "Yükleniyor" })
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
        Text(message, style = MaterialTheme.typography.bodyLarge)
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
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(FurkanSpacing.xl),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(title, style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(FurkanSpacing.xs))
        Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(FurkanSpacing.md))
            FurkanButton(text = actionLabel, onClick = onAction)
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
        title = { Text(title) },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Geri" }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                }
            }
        },
        actions = { actions() },
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
                    Badge { Text(if (count > 99) "99+" else count.toString()) }
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
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
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
    Surface(tonalElevation = 3.dp, shadowElevation = 8.dp) {
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
                    style = MaterialTheme.typography.labelLarge,
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
    contentScale: ContentScale = ContentScale.Crop,
) {
    SubcomposeAsyncImage(
        model = url,
        contentDescription = contentDescription,
        modifier = modifier.background(MaterialTheme.colorScheme.surfaceVariant),
        contentScale = contentScale,
        loading = { FurkanSkeletonBox(Modifier.fillMaxSize()) },
        error = {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Image, contentDescription = null)
            }
        },
    )
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
    isFavorite: Boolean = false,
    onFavoriteClick: (() -> Unit)? = null,
    onAddToCart: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .padding(FurkanSpacing.sm)
            .semantics { contentDescription = name },
    ) {
        Box {
            FurkanNetworkImage(
                url = imageUrl,
                contentDescription = "$name ürün görseli",
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .clip(MaterialTheme.shapes.small),
            )
            if (onCampaign) {
                FurkanBadge(
                    text = "Kampanya",
                    modifier = Modifier.align(Alignment.TopStart).padding(FurkanSpacing.xs),
                )
            }
            if (onFavoriteClick != null) {
                FurkanFavoriteIcon(
                    isFavorite = isFavorite,
                    onClick = onFavoriteClick,
                    modifier = Modifier.align(Alignment.TopEnd),
                )
            }
        }
        Spacer(Modifier.height(FurkanSpacing.xs))
        Text(brand, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(name, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
        if (price != null) FurkanPrice(amount = price, compareAt = compareAt)
        if (stockLabel != null) {
            Text(stockLabel, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (onAddToCart != null) {
            TextButton(onClick = onAddToCart, contentPadding = PaddingValues(0.dp)) {
                Text("Sepete ekle")
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun FurkanProductCardPreview() {
    FurkanSogutmaTheme {
        FurkanProductCard(
            name = "Kompresör X",
            brand = "Furkan",
            imageUrl = null,
            price = "1999.90",
            compareAt = "2499.90",
            onCampaign = true,
            onClick = {},
            modifier = Modifier.width(180.dp),
        )
    }
}
