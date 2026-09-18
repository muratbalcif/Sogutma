package com.furkansogutma.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.furkansogutma.app.core.navigation.FurkanNavHost
import com.furkansogutma.app.core.designsystem.theme.FurkanSogutmaTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            FurkanSogutmaTheme {
                Surface(Modifier.fillMaxSize()) {
                    FurkanNavHost()
                }
            }
        }
    }
}
