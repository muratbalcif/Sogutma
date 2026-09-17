package com.furkansogutma.app.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.outlined.Category
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink
import com.furkansogutma.core.navigation.AppRoute
import com.furkansogutma.core.navigation.DeepLinks
import com.furkansogutma.feature.account.AccountRoute
import com.furkansogutma.feature.account.AddressesRoute
import com.furkansogutma.feature.account.AlertsRoute
import com.furkansogutma.feature.account.BankTransfersRoute
import com.furkansogutma.feature.account.CommentsRoute
import com.furkansogutma.feature.account.CurrentAccountRoute
import com.furkansogutma.feature.account.FavoritesRoute
import com.furkansogutma.feature.account.OrderDetailRoute
import com.furkansogutma.feature.account.OrdersRoute
import com.furkansogutma.feature.account.SettingsRoute
import com.furkansogutma.feature.auth.LoginRoute
import com.furkansogutma.feature.auth.RegisterRoute
import com.furkansogutma.feature.cart.CartRoute
import com.furkansogutma.feature.category.CategoryRoute
import com.furkansogutma.feature.checkout.CheckoutRoute
import com.furkansogutma.feature.home.HomeRoute
import com.furkansogutma.feature.product.ProductDetailRoute
import com.furkansogutma.feature.product.ProductListRoute
import com.furkansogutma.feature.search.SearchRoute
import com.furkansogutma.feature.splash.SplashRoute

private data class TopLevel(val route: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

@Composable
fun FurkanNavHost() {
    val navController = rememberNavController()
    val backStack by navController.currentBackStackEntryAsState()
    val current = backStack?.destination?.route
    val topLevel = listOf(
        TopLevel(AppRoute.Home.route, "Ana Sayfa", Icons.Default.Home),
        TopLevel(AppRoute.Categories.route, "Kategoriler", Icons.Outlined.Category),
        TopLevel(AppRoute.Search.route, "Arama", Icons.Default.Search),
        TopLevel(AppRoute.Cart.route, "Sepet", Icons.Default.ShoppingCart),
        TopLevel(AppRoute.Account.route, "Hesap", Icons.Default.Person),
    )
    val showBottomBar = topLevel.any { it.route == current }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    topLevel.forEach { item ->
                        NavigationBarItem(
                            selected = current == item.route,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = AppRoute.Splash.route,
            modifier = Modifier.padding(padding),
        ) {
            composable(AppRoute.Splash.route) {
                SplashRoute(
                    onAuthenticated = {
                        navController.navigate(AppRoute.Home.route) {
                            popUpTo(AppRoute.Splash.route) { inclusive = true }
                        }
                    },
                    onGuest = {
                        navController.navigate(AppRoute.Login.route) {
                            popUpTo(AppRoute.Splash.route) { inclusive = true }
                        }
                    },
                )
            }
            composable(AppRoute.Login.route) {
                LoginRoute(
                    onLoggedIn = {
                        navController.navigate(AppRoute.Home.route) {
                            popUpTo(AppRoute.Login.route) { inclusive = true }
                        }
                    },
                    onRegister = { navController.navigate(AppRoute.Register.route) },
                )
            }
            composable(AppRoute.Register.route) {
                RegisterRoute(
                    onRegistered = {
                        navController.navigate(AppRoute.Home.route) {
                            popUpTo(AppRoute.Login.route) { inclusive = true }
                        }
                    },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(AppRoute.Home.route) {
                HomeRoute(
                    onProductClick = { navController.navigate(AppRoute.ProductDetail.create(it)) },
                    onCategoryClick = { navController.navigate(AppRoute.CategoryDetail.create(it)) },
                )
            }
            composable(AppRoute.Categories.route) {
                CategoryRoute(
                    onCategoryClick = { navController.navigate("${AppRoute.ProductList.pattern}?category=$it") },
                )
            }
            composable(
                route = "${AppRoute.ProductList.pattern}?category={category}",
                arguments = listOf(navArgument("category") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }),
            ) {
                ProductListRoute(onProductClick = { navController.navigate(AppRoute.ProductDetail.create(it)) })
            }
            composable(AppRoute.ProductList.pattern) {
                ProductListRoute(onProductClick = { navController.navigate(AppRoute.ProductDetail.create(it)) })
            }
            composable(
                route = AppRoute.ProductDetail.pattern,
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
                deepLinks = listOf(navDeepLink { uriPattern = "${DeepLinks.SCHEME}://product/{slug}" }),
            ) {
                ProductDetailRoute()
            }
            composable(
                route = AppRoute.CategoryDetail.pattern,
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
                deepLinks = listOf(navDeepLink { uriPattern = "${DeepLinks.SCHEME}://category/{slug}" }),
            ) {
                ProductListRoute(onProductClick = { navController.navigate(AppRoute.ProductDetail.create(it)) })
            }
            composable(AppRoute.Search.route) {
                SearchRoute(onProductClick = { navController.navigate(AppRoute.ProductDetail.create(it)) })
            }
            composable(AppRoute.Cart.route) {
                CartRoute(
                    onCheckout = { navController.navigate(AppRoute.Checkout.route) },
                    onBrowse = { navController.navigate(AppRoute.Home.route) },
                )
            }
            composable(AppRoute.Checkout.route) {
                CheckoutRoute(
                    onOrderCreated = { id ->
                        navController.navigate(AppRoute.OrderDetail.create(id)) {
                            popUpTo(AppRoute.Cart.route)
                        }
                    },
                )
            }
            composable(AppRoute.Account.route) {
                AccountRoute(
                    onOrders = { navController.navigate(AppRoute.Orders.route) },
                    onFavorites = { navController.navigate(AppRoute.Favorites.route) },
                    onAddresses = { navController.navigate(AppRoute.Addresses.route) },
                    onAlerts = { navController.navigate(AppRoute.Alerts.route) },
                    onComments = { navController.navigate(AppRoute.Comments.route) },
                    onCurrentAccount = { navController.navigate(AppRoute.CurrentAccount.route) },
                    onBankTransfers = { navController.navigate(AppRoute.BankTransfers.route) },
                    onSettings = { navController.navigate(AppRoute.Settings.route) },
                    onLoggedOut = {
                        navController.navigate(AppRoute.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                )
            }
            composable(AppRoute.Orders.route) {
                OrdersRoute(onOrderClick = { navController.navigate(AppRoute.OrderDetail.create(it)) })
            }
            composable(
                route = AppRoute.OrderDetail.pattern,
                arguments = listOf(navArgument("id") { type = NavType.StringType }),
                deepLinks = listOf(navDeepLink { uriPattern = "${DeepLinks.SCHEME}://order/{id}" }),
            ) { entry ->
                OrderDetailRoute(orderId = entry.arguments?.getString("id").orEmpty())
            }
            composable(AppRoute.Favorites.route) {
                FavoritesRoute(onProductClick = { navController.navigate(AppRoute.ProductDetail.create(it)) })
            }
            composable(AppRoute.Addresses.route) { AddressesRoute() }
            composable(AppRoute.Alerts.route) { AlertsRoute() }
            composable(AppRoute.Comments.route) { CommentsRoute() }
            composable(AppRoute.CurrentAccount.route) { CurrentAccountRoute() }
            composable(AppRoute.BankTransfers.route) { BankTransfersRoute() }
            composable(AppRoute.Settings.route) { SettingsRoute() }
        }
    }
}
