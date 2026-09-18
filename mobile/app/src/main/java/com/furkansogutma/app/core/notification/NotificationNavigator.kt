package com.furkansogutma.app.core.notification

import android.content.Context
import android.content.Intent
import com.furkansogutma.app.MainActivity
import com.furkansogutma.app.core.navigation.DeepLinks

object NotificationNavigator {
    fun handle(context: Context, data: Map<String, String>) {
        val uri = resolveDeepLink(data) ?: return
        val intent = Intent(Intent.ACTION_VIEW, android.net.Uri.parse(uri), context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        context.startActivity(intent)
    }

    fun resolveDeepLink(data: Map<String, String>): String? {
        val entityType = data["entityType"]?.uppercase().orEmpty()
        val type = data["type"]?.uppercase().orEmpty()
        val orderId = data["entityId"] ?: data["orderId"] ?: data["id"]
        val productSlug = data["productSlug"] ?: data["slug"]

        return when {
            entityType == "ORDER" || entityType == "PAYMENT" ||
                type.startsWith("ORDER_") || type.startsWith("PAYMENT_") || type == "ORDER" ->
                orderId?.let { DeepLinks.order(it) }

            entityType == "PRODUCT" || type.contains("STOCK") || type == "PRODUCT" || type == "STOCK" ->
                productSlug?.let { DeepLinks.product(it) }

            // Legacy push payloads
            data["type"].equals("order", ignoreCase = true) ->
                orderId?.let { DeepLinks.order(it) }

            data["type"].equals("product", ignoreCase = true) ||
                data["type"].equals("stock", ignoreCase = true) ->
                productSlug?.let { DeepLinks.product(it) }

            else -> null
        }
    }
}
