package com.furkansogutma.app.feature.order.presentation

import androidx.lifecycle.ViewModel
import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.order.domain.model.Order
import com.furkansogutma.app.feature.order.domain.repository.OrderRepository
import com.furkansogutma.app.feature.order.domain.usecase.GetOrderUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class OrderDetailViewModel @Inject constructor(
    private val getOrder: GetOrderUseCase,
    private val orderRepository: OrderRepository,
) : ViewModel() {
    suspend fun load(orderId: String): Result<Order> = getOrder(orderId)
    suspend fun cancelOrder(id: String): Result<Order> = orderRepository.cancelOrder(id)
}
