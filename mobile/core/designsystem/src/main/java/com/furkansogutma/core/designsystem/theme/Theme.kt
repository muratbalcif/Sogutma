package com.furkansogutma.core.designsystem.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = Primary,
    onPrimary = OnPrimary,
    primaryContainer = PrimaryLight,
    onPrimaryContainer = PrimaryDark,
    secondary = Accent,
    onSecondary = OnAccent,
    secondaryContainer = AccentSoft,
    onSecondaryContainer = AccentDark,
    tertiary = PrimaryDark,
    background = Background,
    onBackground = OnSurface,
    surface = Surface,
    onSurface = OnSurface,
    surfaceVariant = SurfaceSecondary,
    onSurfaceVariant = OnSurfaceMuted,
    outline = Outline,
    outlineVariant = OutlineStrong,
    error = Error,
    onError = OnPrimary,
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
