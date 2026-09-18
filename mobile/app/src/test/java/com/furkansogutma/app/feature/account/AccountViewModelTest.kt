package com.furkansogutma.feature.account

import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.database.settings.AppSettingsDataStore
import com.furkansogutma.domain.account.SyncDeviceTokenUseCase
import com.furkansogutma.domain.auth.AuthRepository
import com.furkansogutma.domain.auth.AuthState
import com.furkansogutma.domain.auth.LogoutUseCase
import com.furkansogutma.domain.cart.CartBadgeStore
import com.furkansogutma.domain.notification.NotificationRepository
import com.furkansogutma.domain.notification.UnreadCount
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AccountViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before fun setup() = Dispatchers.setMain(dispatcher)
    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `logout clears badge and invokes callback`() = runTest {
        val auth = mockk<AuthRepository>()
        every { auth.authState } returns MutableStateFlow(AuthState.Guest)
        val logout = mockk<LogoutUseCase>()
        coEvery { logout() } returns Result.Success(Unit)
        val syncDevice = mockk<SyncDeviceTokenUseCase>(relaxed = true)
        val settings = mockk<AppSettingsDataStore>()
        every { settings.fcmToken } returns flowOf("token")
        val notifications = mockk<NotificationRepository>()
        coEvery { notifications.getUnreadCount() } returns Result.Success(UnreadCount(0))
        val badge = CartBadgeStore()
        badge.updateFromCart(
            com.furkansogutma.domain.cart.Cart("1", emptyList(), "0", "0", "10", "TRY"),
        )
        val vm = AccountViewModel(auth, logout, badge, syncDevice, settings, notifications)
        var done = false
        vm.logout { done = true }
        advanceUntilIdle()
        assertThat(done).isTrue()
        assertThat(badge.count.value).isEqualTo(0)
    }
}
