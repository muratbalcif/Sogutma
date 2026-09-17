package com.furkansogutma.app.notifications

import android.content.Context
import android.content.Intent
import com.furkansogutma.app.MainActivity
import com.furkansogutma.core.navigation.DeepLinks

object NotificationNavigator {
    fun handle(context: Context, data: Map<String, String>) {
        val type = data["type"] ?: return
        val uri = when (type) {
            "order" -> data["id"]?.let { DeepLinks.order(it) }
            "product", "stock" -> data["slug"]?.let { DeepLinks.product(it) }
            else -> null
        } ?: return
        val intent = Intent(Intent.ACTION_VIEW, android.net.Uri.parse(uri), context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        context.startActivity(intent)
    }
}
