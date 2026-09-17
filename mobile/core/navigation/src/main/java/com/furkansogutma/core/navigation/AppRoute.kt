package com.furkansogutma.core.navigation

sealed interface AppRoute {
    val route: String

    data object Splash : AppRoute { override val route = "splash" }
    data object Login : AppRoute { override val route = "login" }
    data object Register : AppRoute { override val route = "register" }
    data object ForgotPassword : AppRoute { override val route = "forgot_password" }
    data object Home : AppRoute { override val route = "home" }
    data object Categories : AppRoute { override val route = "categories" }
    data object Search : AppRoute { override val route = "search" }
    data object Cart : AppRoute { override val route = "cart" }
    data object Account : AppRoute { override val route = "account" }
    data object Checkout : AppRoute { override val route = "checkout" }
    data object Orders : AppRoute { override val route = "orders" }
    data object Favorites : AppRoute { override val route = "favorites" }
    data object Addresses : AppRoute { override val route = "addresses" }
    data object AddressForm : AppRoute { override val route = "address_form" }
    data object Alerts : AppRoute { override val route = "alerts" }
    data object CurrentAccount : AppRoute { override val route = "current_account" }
    data object BankTransfers : AppRoute { override val route = "bank_transfers" }
    data object Notifications : AppRoute { override val route = "notifications" }
    data object Settings : AppRoute { override val route = "settings" }
    data object Profile : AppRoute { override val route = "profile" }
    data object ProductList : AppRoute { override val route = "products" }
    data object Campaigns : AppRoute { override val route = "campaigns" }

    data class ProductDetail(val slug: String) : AppRoute {
        override val route = "product/$slug"
    }

    data class CampaignDetail(val slug: String) : AppRoute {
        override val route = "campaign/$slug"
    }

    data class CategoryDetail(val slug: String) : AppRoute {
        override val route = "category/$slug"
    }

    data class OrderDetail(val id: String) : AppRoute {
        override val route = "order/$id"
    }
}

object AppRoutes {
    const val PRODUCT_DETAIL = "product/{slug}"
    const val CAMPAIGN_DETAIL = "campaign/{slug}"
    const val CATEGORY_DETAIL = "category/{slug}"
    const val ORDER_DETAIL = "order/{id}"
    const val PRODUCT_LIST_WITH_CATEGORY = "products?category={category}"
    const val ORDER_SUCCESS = "order_success/{orderId}?payment={payment}"
    const val BANK_TRANSFERS_WITH_ORDER = "bank_transfers?orderId={orderId}"
    const val LEGAL = "legal/{slug}"

    fun productDetail(slug: String) = "product/$slug"
    fun campaignDetail(slug: String) = "campaign/$slug"
    fun categoryDetail(slug: String) = "category/$slug"
    fun orderDetail(id: String) = "order/$id"
    fun legal(slug: String) = "legal/$slug"
    fun productList(category: String? = null) =
        if (category.isNullOrBlank()) "products" else "products?category=$category"
    fun orderSuccess(orderId: String, payment: String) =
        "order_success/$orderId?payment=$payment"
    fun addressForm(addressId: String? = null) =
        if (addressId == null) "address_form" else "address_form?addressId=$addressId"
}

object DeepLinks {
    const val SCHEME = "furkansogutma"
    fun product(slug: String) = "$SCHEME://product/$slug"
    fun category(slug: String) = "$SCHEME://category/$slug"
    fun order(id: String) = "$SCHEME://order/$id"
}
