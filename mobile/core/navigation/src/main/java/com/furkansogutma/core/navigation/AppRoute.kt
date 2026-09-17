package com.furkansogutma.core.navigation

sealed interface AppRoute {
    val route: String

    data object Splash : AppRoute { override val route = "splash" }
    data object Login : AppRoute { override val route = "login" }
    data object Register : AppRoute { override val route = "register" }
    data object Main : AppRoute { override val route = "main" }
    data object Home : AppRoute { override val route = "home" }
    data object Categories : AppRoute { override val route = "categories" }
    data object Search : AppRoute { override val route = "search" }
    data object Cart : AppRoute { override val route = "cart" }
    data object Account : AppRoute { override val route = "account" }
    data object Checkout : AppRoute { override val route = "checkout" }
    data object Orders : AppRoute { override val route = "orders" }
    data object Favorites : AppRoute { override val route = "favorites" }
    data object Addresses : AppRoute { override val route = "addresses" }
    data object Alerts : AppRoute { override val route = "alerts" }
    data object Comments : AppRoute { override val route = "comments" }
    data object CurrentAccount : AppRoute { override val route = "current_account" }
    data object BankTransfers : AppRoute { override val route = "bank_transfers" }
    data object Settings : AppRoute { override val route = "settings" }

    data class ProductDetail(val slug: String) : AppRoute {
        override val route = "product/$slug"
        companion object {
            const val pattern = "product/{slug}"
            fun create(slug: String) = "product/$slug"
        }
    }

    data class CategoryDetail(val slug: String) : AppRoute {
        override val route = "category/$slug"
        companion object {
            const val pattern = "category/{slug}"
            fun create(slug: String) = "category/$slug"
        }
    }

    data class OrderDetail(val id: String) : AppRoute {
        override val route = "order/$id"
        companion object {
            const val pattern = "order/{id}"
            fun create(id: String) = "order/$id"
        }
    }

    data class ProductList(val category: String? = null) : AppRoute {
        override val route = if (category != null) "products?category=$category" else "products"
        companion object {
            const val pattern = "products"
        }
    }
}

object DeepLinks {
    const val SCHEME = "furkansogutma"
    fun product(slug: String) = "$SCHEME://product/$slug"
    fun category(slug: String) = "$SCHEME://category/$slug"
    fun order(id: String) = "$SCHEME://order/$id"
}
