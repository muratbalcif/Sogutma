package com.furkansogutma.app.feature.splash.presentation

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.furkansogutma.app.core.designsystem.theme.FurkanSpacing
import com.furkansogutma.app.core.designsystem.theme.Navy
import kotlinx.coroutines.delay

@Composable
fun SplashRoute(
    onAuthenticated: () -> Unit,
    onGuest: () -> Unit,
    viewModel: SplashViewModel = hiltViewModel(),
) {
    val destination by viewModel.destination.collectAsStateWithLifecycle()
    LaunchedEffect(destination) {
        when (destination) {
            SplashDestination.Home -> onAuthenticated()
            SplashDestination.Login -> onGuest()
            SplashDestination.Loading -> Unit
        }
    }
    SplashScreen()
}

@Composable
fun SplashScreen() {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(50)
        visible = true
    }
    val alpha by animateFloatAsState(if (visible) 1f else 0f, tween(700), label = "splash")
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy)
            .semantics { contentDescription = "Splash" },
        contentAlignment = Alignment.Center,
    ) {
        Column(Modifier.alpha(alpha), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("FurkanSoğutma", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.onPrimary)
            Spacer(Modifier.height(FurkanSpacing.sm))
            Text("Soğutma çözümleri", color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.85f))
        }
    }
}
