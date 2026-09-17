package com.furkansogutma.app.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.outlined.Category
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarDefaults
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.furkansogutma.core.designsystem.theme.BadgeRed
import com.furkansogutma.core.designsystem.theme.White
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink
import com.furkansogutma.core.navigation.AppRoute
import com.furkansogutma.core.navigation.AppRoutes
import com.furkansogutma.core.navigation.DeepLinks
import com.furkansogutma.domain.auth.AuthRepository
import com.furkansogutma.domain.auth.AuthState
import com.furkansogutma.domain.cart.CartBadgeStore
import com.furkansogutma.feature.account.AccountRoute
import com.furkansogutma.feature.account.AddressFormRoute
import com.furkansogutma.feature.account.AddressesRoute
import com.furkansogutma.feature.account.AlertsRoute
import com.furkansogutma.feature.account.BankTransfersRoute
import com.furkansogutma.feature.account.CurrentAccountRoute
import com.furkansogutma.feature.account.FavoritesRoute
import com.furkansogutma.feature.account.NotificationsRoute
import com.furkansogutma.feature.account.OrderDetailRoute
import com.furkansogutma.feature.account.OrdersRoute
import com.furkansogutma.feature.account.ProfileRoute
import com.furkansogutma.feature.account.SettingsRoute
import com.furkansogutma.feature.auth.ForgotPasswordRoute
import com.furkansogutma.feature.auth.LoginRoute
import com.furkansogutma.feature.auth.RegisterRoute
import com.furkansogutma.feature.campaign.CampaignDetailRoute
import com.furkansogutma.feature.campaign.CampaignListRoute
import com.furkansogutma.feature.cart.CartRoute
import com.furkansogutma.feature.category.CategoryRoute
import com.furkansogutma.feature.checkout.CheckoutRoute
import com.furkansogutma.feature.checkout.OrderSuccessRoute
import com.furkansogutma.feature.home.HomeRoute
import com.furkansogutma.feature.product.ProductDetailRoute
import com.furkansogutma.feature.product.ProductListRoute
import com.furkansogutma.feature.search.SearchRoute
import com.furkansogutma.feature.splash.SplashRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn

private data class TopLevel(val route: String, val label: String, val icon: ImageVector)

@HiltViewModel
class MainNavViewModel @Inject constructor(
    authRepository: AuthRepository,
    badgeStore: CartBadgeStore,
) : ViewModel() {
    val authState = authRepository.authState.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        AuthState.Loading,
    )
    val cartCount = badgeStore.count
}

@Composable
fun FurkanNavHost(
    viewModel: MainNavViewModel = hiltViewModel(),
) {
    val navController = rememberNavController()
    val backStack by navController.currentBackStackEntryAsState()
    val current = backStack?.destination?.route
    val cartCount by viewModel.cartCount.collectAsStateWithLifecycle()
    val authState by viewModel.authState.collectAsStateWithLifecycle()

    LaunchedEffect(authState) {
        if (authState is AuthState.Guest &&
            current?.startsWith("order/") == true
        ) {
            // deep link order while guest handled at destination level
        }
    }

    val topLevel = listOf(
        TopLevel(AppRoute.Home.route, "Anasayfa", Icons.Default.Home),
        TopLevel(AppRoute.Categories.route, "Kategoriler", Icons.Outlined.Category),
        TopLevel(AppRoute.Search.route, "Ara", Icons.Default.Search),
        TopLevel(AppRoute.Cart.route, "Sepet", Icons.Default.ShoppingCart),
        TopLevel(AppRoute.Account.route, "Hesabım", Icons.Default.Person),
    )
    val showBottomBar = topLevel.any { it.route == current }

    fun goHomeClearingAuth() {
        navController.navigate(AppRoute.Home.route) {
            popUpTo(0) { inclusive = true }
            launchSingleTop = true
        }
    }

    fun goLoginClearing() {
        navController.navigate(AppRoute.Login.route) {
            popUpTo(0) { inclusive = true }
            launchSingleTop = true
        }
    }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    containerColor = White,
                    tonalElevation = 0.dp,
                    windowInsets = NavigationBarDefaults.windowInsets,
                ) {
                    topLevel.forEach { item ->
                        val selected = current == item.route
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = {
                                if (item.route == AppRoute.Cart.route) {
                                    BadgedBox(
                                        badge = {
                                            if (cartCount > 0) {
                                                Badge(containerColor = BadgeRed) {
                                                    Text(if (cartCount > 99) "99+" else "$cartCount")
                                                }
                                            }
                                        },
                                    ) {
                                        Icon(item.icon, contentDescription = item.label)
                                    }
                                } else {
                                    Icon(item.icon, contentDescription = item.label)
                                }
                            },
                            label = {
                                Text(
                                    item.label,
                                    style = MaterialTheme.typography.labelSmall,
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = MaterialTheme.colorScheme.primary,
                                selectedTextColor = MaterialTheme.colorScheme.primary,
                                unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                indicatorColor = Color.Transparent,
                            ),
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
                    onLoggedIn = { goHomeClearingAuth() },
                    onRegister = { navController.navigate(AppRoute.Register.route) },
                    onForgotPassword = { navController.navigate(AppRoute.ForgotPassword.route) },
                )
            }
            composable(AppRoute.Register.route) {
                RegisterRoute(
                    onRegistered = { goHomeClearingAuth() },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(AppRoute.ForgotPassword.route) {
                ForgotPasswordRoute(onBack = { navController.popBackStack() })
            }
            composable(AppRoute.Home.route) {
                HomeRoute(
                    onProductClick = { navController.navigate(AppRoutes.productDetail(it)) },
                    onCategoryClick = { navController.navigate(AppRoutes.productList(it)) },
                    onSearchClick = {
                        navController.navigate(AppRoute.Search.route) {
                            launchSingleTop = true
                        }
                    },
                    onCartClick = {
                        navController.navigate(AppRoute.Cart.route) { launchSingleTop = true }
                    },
                    onSeeAllProducts = { navController.navigate(AppRoutes.productList(it)) },
                    onSeeAllCampaigns = { navController.navigate(AppRoute.Campaigns.route) },
                )
            }
            composable(AppRoute.Categories.route) {
                CategoryRoute(
                    onCategoryClick = { navController.navigate(AppRoutes.productList(it)) },
                )
            }
            composable(
                route = AppRoutes.PRODUCT_LIST_WITH_CATEGORY,
                arguments = listOf(
                    navArgument("category") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
            ) {
                ProductListRoute(
                    onProductClick = { navController.navigate(AppRoutes.productDetail(it)) },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(AppRoute.ProductList.route) {
                ProductListRoute(
                    onProductClick = { navController.navigate(AppRoutes.productDetail(it)) },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(AppRoute.Campaigns.route) {
                CampaignListRoute(
                    onCampaignClick = { navController.navigate(AppRoutes.campaignDetail(it)) },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(
                route = AppRoutes.CAMPAIGN_DETAIL,
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
            ) {
                CampaignDetailRoute(
                    onProductClick = { navController.navigate(AppRoutes.productDetail(it)) },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(
                route = AppRoutes.PRODUCT_DETAIL,
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
                deepLinks = listOf(navDeepLink { uriPattern = "${DeepLinks.SCHEME}://product/{slug}" }),
            ) {
                ProductDetailRoute(
                    onBack = { navController.popBackStack() },
                    onRelatedProductClick = { navController.navigate(AppRoutes.productDetail(it)) },
                )
            }
            composable(
                route = AppRoutes.CATEGORY_DETAIL,
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
                deepLinks = listOf(navDeepLink { uriPattern = "${DeepLinks.SCHEME}://category/{slug}" }),
            ) {
                ProductListRoute(
                    onProductClick = { navController.navigate(AppRoutes.productDetail(it)) },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(AppRoute.Search.route) {
                SearchRoute(onProductClick = { navController.navigate(AppRoutes.productDetail(it)) })
            }
            composable(AppRoute.Cart.route) {
                CartRoute(
                    onCheckout = { navController.navigate(AppRoute.Checkout.route) },
                    onBrowse = { navController.navigate(AppRoute.Home.route) },
                )
            }
            composable(AppRoute.Checkout.route) {
                CheckoutRoute(
                    onOrderCreated = { orderId, payment ->
                        navController.navigate(AppRoutes.orderSuccess(orderId, payment)) {
                            popUpTo(AppRoute.Cart.route)
                        }
                    },
                    onBack = { navController.popBackStack() },
                    onManageAddresses = { navController.navigate(AppRoute.Addresses.route) },
                )
            }
            composable(
                route = "order_success/{orderId}?payment={payment}",
                arguments = listOf(
                    navArgument("orderId") { type = NavType.StringType },
                    navArgument("payment") {
                        type = NavType.StringType
                        defaultValue = "BANK_TRANSFER"
                    },
                ),
            ) { entry ->
                val orderId = entry.arguments?.getString("orderId").orEmpty()
                val payment = entry.arguments?.getString("payment").orEmpty()
                OrderSuccessRoute(
                    orderId = orderId,
                    paymentMethod = payment,
                    onViewOrder = { navController.navigate(AppRoutes.orderDetail(it)) },
                    onContinueShopping = {
                        navController.navigate(AppRoute.Home.route) {
                            popUpTo(AppRoute.Home.route) { inclusive = true }
                        }
                    },
                    onBankTransfer = {
                        navController.navigate("bank_transfers?orderId=$it")
                    },
                )
            }
            composable(AppRoute.Account.route) {
                AccountRoute(
                    onOrders = { navController.navigate(AppRoute.Orders.route) },
                    onNotifications = { navController.navigate(AppRoute.Notifications.route) },
                    onFavorites = { navController.navigate(AppRoute.Favorites.route) },
                    onAddresses = { navController.navigate(AppRoute.Addresses.route) },
                    onAlerts = { navController.navigate(AppRoute.Alerts.route) },
                    onCurrentAccount = { navController.navigate(AppRoute.CurrentAccount.route) },
                    onBankTransfers = { navController.navigate(AppRoute.BankTransfers.route) },
                    onSettings = { navController.navigate(AppRoute.Settings.route) },
                    onProfile = { navController.navigate(AppRoute.Profile.route) },
                    onLoggedOut = { goLoginClearing() },
                )
            }
            composable(AppRoute.Profile.route) {
                ProfileRoute(onBack = { navController.popBackStack() })
            }
            composable(AppRoute.Orders.route) {
                OrdersRoute(
                    onOrderClick = { navController.navigate(AppRoutes.orderDetail(it)) },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(AppRoute.Notifications.route) {
                NotificationsRoute(
                    onOrderClick = { navController.navigate(AppRoutes.orderDetail(it)) },
                    onProductClick = { navController.navigate(AppRoutes.productDetail(it)) },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(
                route = AppRoutes.ORDER_DETAIL,
                arguments = listOf(navArgument("id") { type = NavType.StringType }),
                deepLinks = listOf(navDeepLink { uriPattern = "${DeepLinks.SCHEME}://order/{id}" }),
            ) { entry ->
                val id = entry.arguments?.getString("id").orEmpty()
                if (authState is AuthState.Guest) {
                    LaunchedEffect(id) {
                        navController.navigate(AppRoute.Login.route) {
                            launchSingleTop = true
                        }
                    }
                } else {
                    OrderDetailRoute(orderId = id, onBack = { navController.popBackStack() })
                }
            }
            composable(AppRoute.Favorites.route) {
                FavoritesRoute(
                    onProductClick = { navController.navigate(AppRoutes.productDetail(it)) },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(AppRoute.Addresses.route) {
                AddressesRoute(
                    onBack = { navController.popBackStack() },
                    onCreate = { navController.navigate(AppRoutes.addressForm()) },
                )
            }
            composable(AppRoute.AddressForm.route) {
                AddressFormRoute(
                    onBack = { navController.popBackStack() },
                    onSaved = { navController.popBackStack() },
                )
            }
            composable(AppRoute.Alerts.route) {
                AlertsRoute(onBack = { navController.popBackStack() })
            }
            composable(AppRoute.CurrentAccount.route) {
                CurrentAccountRoute(onBack = { navController.popBackStack() })
            }
            composable(AppRoute.BankTransfers.route) {
                BankTransfersRoute(onBack = { navController.popBackStack() })
            }
            composable(
                route = "bank_transfers?orderId={orderId}",
                arguments = listOf(
                    navArgument("orderId") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
            ) { entry ->
                BankTransfersRoute(
                    orderId = entry.arguments?.getString("orderId"),
                    onBack = { navController.popBackStack() },
                )
            }
            composable(AppRoute.Settings.route) {
                SettingsRoute(onBack = { navController.popBackStack() })
            }
        }
    }
}
