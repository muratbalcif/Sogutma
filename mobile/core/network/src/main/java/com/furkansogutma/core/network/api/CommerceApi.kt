package com.furkansogutma.core.network.api

import com.furkansogutma.core.network.dto.AddCartItemRequestDto
import com.furkansogutma.core.network.dto.AddressDto
import com.furkansogutma.core.network.dto.AccountCurrentDto
import com.furkansogutma.core.network.dto.AccountTransactionDto
import com.furkansogutma.core.network.dto.BankTransferDto
import com.furkansogutma.core.network.dto.CartDto
import com.furkansogutma.core.network.dto.CartValidationDto
import com.furkansogutma.core.network.dto.CompanyBankAccountDto
import com.furkansogutma.core.network.dto.CreateAddressRequestDto
import com.furkansogutma.core.network.dto.CreateBankTransferRequestDto
import com.furkansogutma.core.network.dto.CreateOrderRequestDto
import com.furkansogutma.core.network.dto.CreatePaymentRequestDto
import com.furkansogutma.core.network.dto.FavoriteDto
import com.furkansogutma.core.network.dto.OrderDto
import com.furkansogutma.core.network.dto.PaginatedDto
import com.furkansogutma.core.network.dto.PaymentDto
import com.furkansogutma.core.network.dto.ProductAlertDto
import com.furkansogutma.core.network.dto.RegisterDeviceRequestDto
import com.furkansogutma.core.network.dto.UpdateCartItemRequestDto
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PATCH
import retrofit2.http.Path
import retrofit2.http.Query

interface CommerceApi {
    @GET("cart")
    suspend fun cart(): CartDto

    @POST("cart/items")
    suspend fun addCartItem(@Body body: AddCartItemRequestDto): CartDto

    @PATCH("cart/items/{productId}")
    suspend fun updateCartItem(
        @Path("productId") productId: String,
        @Body body: UpdateCartItemRequestDto,
    ): CartDto

    @DELETE("cart/items/{productId}")
    suspend fun removeCartItem(@Path("productId") productId: String): CartDto

    @POST("cart/validate")
    suspend fun validateCart(): CartValidationDto

    @GET("favorites")
    suspend fun favorites(): List<FavoriteDto>

    @POST("favorites/{productId}")
    suspend fun addFavorite(@Path("productId") productId: String): FavoriteDto

    @DELETE("favorites/{productId}")
    suspend fun removeFavorite(@Path("productId") productId: String): Map<String, Boolean>

    @GET("addresses")
    suspend fun addresses(): List<AddressDto>

    @POST("addresses")
    suspend fun createAddress(@Body body: CreateAddressRequestDto): AddressDto

    @PATCH("addresses/{id}")
    suspend fun updateAddress(@Path("id") id: String, @Body body: CreateAddressRequestDto): AddressDto

    @DELETE("addresses/{id}")
    suspend fun deleteAddress(@Path("id") id: String): Map<String, Boolean>

    @POST("orders")
    suspend fun createOrder(@Body body: CreateOrderRequestDto): OrderDto

    @GET("orders")
    suspend fun orders(@Query("page") page: Int = 1, @Query("limit") limit: Int = 20): PaginatedDto<OrderDto>

    @GET("orders/{id}")
    suspend fun order(@Path("id") id: String): OrderDto

    @POST("orders/{orderId}/payment")
    suspend fun createPayment(
        @Path("orderId") orderId: String,
        @Body body: CreatePaymentRequestDto,
    ): PaymentDto

    @GET("product-alerts")
    suspend fun productAlerts(): List<ProductAlertDto>

    @POST("products/{productId}/alerts")
    suspend fun createAlert(@Path("productId") productId: String): ProductAlertDto

    @DELETE("products/{productId}/alerts")
    suspend fun deleteAlert(@Path("productId") productId: String): Map<String, Boolean>

    @GET("account/current")
    suspend fun currentAccount(): AccountCurrentDto

    @GET("account/transactions")
    suspend fun accountTransactions(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50,
    ): PaginatedDto<AccountTransactionDto>

    @GET("bank-transfers")
    suspend fun bankTransfers(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50,
    ): PaginatedDto<BankTransferDto>

    @GET("payment/bank-accounts")
    suspend fun bankAccounts(): List<CompanyBankAccountDto>

    @POST("orders/{orderId}/bank-transfer")
    suspend fun createBankTransfer(
        @Path("orderId") orderId: String,
        @Body body: CreateBankTransferRequestDto,
    ): BankTransferDto

    @POST("notifications/devices")
    suspend fun registerDevice(@Body body: RegisterDeviceRequestDto): Map<String, Any>

    @DELETE("notifications/devices/{token}")
    suspend fun unregisterDevice(@Path("token") token: String): Map<String, Boolean>
}
