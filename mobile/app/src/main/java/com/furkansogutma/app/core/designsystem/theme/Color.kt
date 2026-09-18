package com.furkansogutma.app.core.designsystem.theme

import androidx.compose.ui.graphics.Color

/**
 * 60-30-10 palette (shared with web):
 * Main #186195 · Secondary #F4F8FB · Accent #137262
 */
val Primary = Color(0xFF186195)
val PrimaryDark = Color(0xFF124A73)
val PrimaryLight = Color(0xFFD6E6F2)
val PrimarySoft = Color(0xFFEAF2F8)

val Accent = Color(0xFF137262)
val AccentDark = Color(0xFF0E5A4D)
val AccentSoft = Color(0xFFD7EDE8)

val White = Color(0xFFFFFFFF)
val Background = Color(0xFFFDFDFD)
val Surface = Color(0xFFFFFFFF)
val SurfaceSecondary = Color(0xFFF4F8FB)
val Outline = Color(0xFFD5E2EC)
val OutlineStrong = Color(0xFFB7CBD9)

val OnSurface = Color(0xFF186195)
val OnSurfaceSecondary = Color(0xFF4A6F8A)
val OnSurfaceMuted = Color(0xFF5F8199)
val OnSurfaceFaint = Color(0xFF7A97AD)

val Success = Color(0xFF137262)
val Error = Color(0xFFDC2626)
val Warning = Color(0xFFC27803)
val BadgeRed = Color(0xFFDC2626)

val OnPrimary = Color(0xFFFFFFFF)
val OnAccent = Color(0xFFFFFFFF)

/* Legacy aliases — keep binary/source compat during migrate */
val Navy = Primary
val NavyDark = PrimaryDark
val NavyMuted = PrimaryDark
val AccentOrange = Accent
val AccentOrangeSoft = AccentSoft
val SurfaceElevated = Surface
val SurfaceVariant = SurfaceSecondary
val OnNavy = OnPrimary
