package com.furkansogutma.core.designsystem.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = Navy,
    onPrimary = OnNavy,
    primaryContainer = NavyMuted,
    onPrimaryContainer = OnNavy,
    secondary = AccentOrange,
    onSecondary = OnNavy,
    secondaryContainer = AccentOrangeSoft,
    onSecondaryContainer = Navy,
    tertiary = NavyMuted,
    background = Surface,
    onBackground = OnSurface,
    surface = SurfaceElevated,
    onSurface = OnSurface,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = OnSurfaceMuted,
    outline = Outline,
    outlineVariant = OutlineStrong,
    error = Error,
    onError = OnNavy,
)

@Composable
fun FurkanSogutmaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColors,
        typography = FurkanTypography,
        shapes = FurkanShapes,
        content = content,
    )
}
