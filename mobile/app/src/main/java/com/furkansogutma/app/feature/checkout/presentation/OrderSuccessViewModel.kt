package com.furkansogutma.app.feature.checkout.presentation

import androidx.lifecycle.ViewModel
import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.account.domain.model.CompanyBankAccount
import com.furkansogutma.app.feature.account.domain.repository.AccountRepository
import com.furkansogutma.app.feature.order.domain.model.Order
import com.furkansogutma.app.feature.order.domain.usecase.GetOrderUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class OrderSuccessViewModel @Inject constructor(
    private val getOrder: GetOrderUseCase,
    private val accountRepository: AccountRepository,
) : ViewModel() {
    suspend fun loadOrder(orderId: String): Result<Order> = getOrder(orderId)
    suspend fun getBankAccounts(): Result<List<CompanyBankAccount>> = accountRepository.getBankAccounts()
}
