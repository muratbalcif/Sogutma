package com.furkansogutma.domain.account

data class Address(
    val id: String,
    val title: String,
    val firstName: String,
    val lastName: String,
    val phone: String,
    val city: String,
    val district: String,
    val neighborhood: String?,
    val addressLine: String,
    val postalCode: String?,
    val country: String,
    val isDefault: Boolean,
) {
    val fullName: String get() = "$firstName $lastName".trim()
}

data class AddressInput(
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

data class ProductAlert(
    val id: String,
    val productId: String,
    val productName: String?,
    val productSlug: String?,
    val status: String?,
    val createdAt: String?,
)

data class CurrentAccount(
    val balance: String,
    val debit: String?,
    val credit: String?,
    val currency: String,
)

data class AccountTransaction(
    val id: String,
    val type: String,
    val amount: String,
    val balanceAfter: String?,
    val description: String?,
    val createdAt: String,
)

data class BankTransfer(
    val id: String,
    val orderId: String?,
    val amount: String,
    val transferDate: String?,
    val description: String?,
    val status: String,
    val bankName: String?,
    val senderName: String?,
    val remainingAmount: String? = null,
    val approvedTotal: String? = null,
    val paymentStatus: String? = null,
    val orderTotal: String? = null,
    val referenceNumber: String? = null,
)

data class SiteConfig(
    val siteName: String,
    val supportEmail: String,
    val supportPhone: String,
    val address: String,
    val privacyUrl: String,
    val kvkkUrl: String,
    val termsUrl: String,
    val bankName: String,
    val iban: String,
    val accountName: String,
)

data class LegalPage(
    val slug: String,
    val title: String,
    val body: String,
    val updatedAt: String,
)

data class CompanyBankAccount(
    val id: String,
    val bankName: String,
    val accountName: String,
    val iban: String,
    val branch: String?,
    val currency: String,
    val description: String?,
)
