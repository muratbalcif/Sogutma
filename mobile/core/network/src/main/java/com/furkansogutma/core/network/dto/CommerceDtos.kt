package com.furkansogutma.core.network.dto

data class CartDto(
    val id: String,
    val items: List<CartItemDto> = emptyList(),
    val summary: CartSummaryDto,
)

data class CartSummaryDto(
    val subtotal: String,
    val discount: String,
    val total: String,
    val currency: String,
)

data class CartItemDto(
    val product: CartProductDto,
    val quantity: Int,
    val unitPrice: String? = null,
    val currency: String? = null,
    val subtotal: String? = null,
    val availableQuantity: Int = 0,
    val available: Boolean = true,
    val issueCode: String? = null,
)

data class CartProductDto(
    val id: String,
    val name: String,
    val slug: String,
    val sku: String,
    val images: List<ProductImageDto> = emptyList(),
)

data class AddCartItemRequestDto(
    val productId: String,
    val quantity: Int,
)

data class UpdateCartItemRequestDto(
    val quantity: Int,
)

data class CartValidationDto(
    val valid: Boolean,
    val issues: List<CartValidationIssueDto> = emptyList(),
)

data class CartValidationIssueDto(
    val productId: String,
    val code: String,
    val message: String,
)

data class AddressDto(
    val id: String,
    val title: String,
    val firstName: String,
    val lastName: String,
    val phone: String,
    val city: String,
    val district: String,
    val neighborhood: String? = null,
    val addressLine: String,
    val postalCode: String? = null,
    val country: String = "TR",
    val isDefault: Boolean = false,
)

data class CreateAddressRequestDto(
    val title: String,
    val firstName: String,
    val lastName: String,
    val phone: String,
    val city: String,
    val district: String,
    val neighborhood: String? = null,
    val addressLine: String,
    val postalCode: String? = null,
    val country: String = "TR",
    val isDefault: Boolean = false,
)

data class CreateOrderRequestDto(
    val shippingAddressId: String,
    val billingAddressId: String,
    val customerNote: String? = null,
    val couponCode: String? = null,
)

data class CheckoutValidateRequestDto(
    val shippingAddressId: String,
    val billingAddressId: String,
    val customerNote: String? = null,
    val couponCode: String? = null,
)

data class ValidateCouponRequestDto(
    val code: String,
    val orderAmount: String? = null,
)

data class CouponValidationDto(
    val valid: Boolean,
    val code: String? = null,
    val message: String? = null,
    val discountAmount: String? = null,
    val couponId: String? = null,
)

data class CheckoutValidationDto(
    val valid: Boolean,
    val items: List<CheckoutValidationItemDto> = emptyList(),
    val summary: CheckoutValidationSummaryDto? = null,
    val issues: List<CheckoutValidationIssueDto> = emptyList(),
)

data class CheckoutValidationItemDto(
    val productId: String,
    val productName: String,
    val sku: String,
    val quantity: Int,
    val unitPrice: String,
    val total: String? = null,
)

data class CheckoutValidationSummaryDto(
    val subtotal: String? = null,
    val discount: String? = null,
    val couponDiscount: String? = null,
    val couponCode: String? = null,
    val tax: String? = null,
    val shipping: String? = null,
    val total: String? = null,
    val currency: String? = null,
)

data class CheckoutValidationIssueDto(
    val code: String,
    val message: String,
    val productId: String? = null,
)

data class CreatePaymentRequestDto(
    val method: String,
)

data class OrderDto(
    val id: String,
    val orderNumber: String,
    val status: String,
    val currency: String,
    val subtotal: String,
    val discountAmount: String,
    val taxAmount: String,
    val shippingAmount: String,
    val totalAmount: String,
    val customerNote: String? = null,
    val shippingAddress: AddressDto? = null,
    val billingAddress: AddressDto? = null,
    val items: List<OrderItemDto> = emptyList(),
    val statusHistory: List<OrderStatusHistoryDto> = emptyList(),
    val payment: PaymentDto? = null,
    val shipping: ShippingDto? = null,
    val canCancel: Boolean = false,
    val createdAt: String,
    val updatedAt: String? = null,
)

data class ShippingDto(
    val id: String? = null,
    val orderId: String? = null,
    val provider: String? = null,
    val trackingNumber: String? = null,
    val trackingUrl: String? = null,
    val status: String? = null,
    val shippedAt: String? = null,
    val deliveredAt: String? = null,
    val note: String? = null,
)

data class OrderItemDto(
    val id: String,
    val productId: String? = null,
    val productName: String,
    val sku: String,
    val quantity: Int,
    val unitPrice: String,
    val totalAmount: String,
)

data class OrderStatusHistoryDto(
    val id: String,
    val fromStatus: String? = null,
    val toStatus: String,
    val note: String? = null,
    val createdAt: String,
)

data class PaymentDto(
    val id: String,
    val status: String,
    val amount: String,
    val currency: String,
    val provider: String? = null,
    val method: String? = null,
)

data class FavoriteDto(
    val id: String? = null,
    val productId: String? = null,
    val product: ProductDto,
    val createdAt: String? = null,
)

data class ProductAlertDto(
    val id: String,
    val productId: String,
    val product: ProductDto? = null,
    val status: String? = null,
    val createdAt: String? = null,
)

data class AccountCurrentDto(
    val balance: String,
    val totalDebit: String? = null,
    val totalCredit: String? = null,
    val debit: String? = null,
    val credit: String? = null,
    val currency: String = "TRY",
    val overdueAmount: String? = null,
)

data class AccountTransactionDto(
    val id: String,
    val type: String,
    val amount: String,
    val balanceAfter: String? = null,
    val description: String? = null,
    val createdAt: String,
)

data class BankTransferDto(
    val id: String,
    val orderId: String? = null,
    val amount: String,
    val transferDate: String? = null,
    val description: String? = null,
    val status: String,
    val bankName: String? = null,
    val senderName: String? = null,
)

data class CreateBankTransferRequestDto(
    val senderName: String,
    val senderIban: String? = null,
    val transferDate: String,
    val amount: String? = null,
    val bankAccountId: String? = null,
    val referenceNumber: String? = null,
    val note: String? = null,
)

data class RegisterDeviceRequestDto(
    val token: String,
    val platform: String = "ANDROID",
)

data class NotificationDto(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val message: String? = null,
    val data: NotificationDataDto? = null,
    val entityType: String? = null,
    val entityId: String? = null,
    val readAt: String? = null,
    val createdAt: String,
)

data class NotificationDataDto(
    val orderId: String? = null,
    val orderNumber: String? = null,
    val productId: String? = null,
    val productSlug: String? = null,
    val slug: String? = null,
    val trackingUrl: String? = null,
    val trackingNumber: String? = null,
)

data class UnreadCountDto(
    val count: Int,
)

data class NotificationPreferenceDto(
    val orderNotifications: Boolean = true,
    val paymentNotifications: Boolean = true,
    val stockAlerts: Boolean = true,
    val campaignNotifications: Boolean = true,
    val systemNotifications: Boolean = true,
)

data class MarkAllReadResponseDto(
    val updated: Int = 0,
)

data class SiteConfigDto(
    val siteName: String,
    val supportEmail: String,
    val supportPhone: String,
    val address: String,
    val privacyUrl: String,
    val kvkkUrl: String,
    val termsUrl: String,
    val bankTransferInfo: BankTransferInfoDto,
)

data class LegalPageDto(
    val slug: String,
    val title: String,
    val body: String,
    val updatedAt: String,
)

data class BankTransferInfoDto(
    val bankName: String,
    val iban: String,
    val accountName: String,
)

data class CompanyBankAccountDto(
    val id: String,
    val bankName: String,
    val accountName: String,
    val iban: String,
    val branch: String? = null,
    val currency: String = "TRY",
    val description: String? = null,
    val sortOrder: Int = 0,
)

data class ForgotPasswordRequestDto(
    val email: String,
)

data class MessageResponseDto(
    val message: String,
)
