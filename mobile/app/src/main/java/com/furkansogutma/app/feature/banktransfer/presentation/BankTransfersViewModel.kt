package com.furkansogutma.app.feature.banktransfer.presentation

import androidx.lifecycle.ViewModel
import com.furkansogutma.app.feature.account.domain.repository.AccountRepository
import com.furkansogutma.app.feature.order.domain.usecase.GetOrderUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class BankTransfersViewModel @Inject constructor(
    val accountRepository: AccountRepository,
    val getOrder: GetOrderUseCase,
) : ViewModel()
