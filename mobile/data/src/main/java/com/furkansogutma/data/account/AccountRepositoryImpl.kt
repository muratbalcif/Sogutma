package com.furkansogutma.data.account

import com.furkansogutma.core.common.result.Result
import com.furkansogutma.core.network.api.CatalogApi
import com.furkansogutma.core.network.api.CommerceApi
import com.furkansogutma.core.network.dto.CreateAddressRequestDto
import com.furkansogutma.core.network.dto.CreateBankTransferRequestDto
import com.furkansogutma.core.network.dto.RegisterDeviceRequestDto
import com.furkansogutma.data.mapper.toDomain
import com.furkansogutma.data.remote.SafeApiCall
import com.furkansogutma.domain.account.AccountRepository
import com.furkansogutma.domain.account.AccountTransaction
import com.furkansogutma.domain.account.Address
import com.furkansogutma.domain.account.AddressInput
import com.furkansogutma.domain.account.BankTransfer
import com.furkansogutma.domain.account.CompanyBankAccount
import com.furkansogutma.domain.account.CurrentAccount
import com.furkansogutma.domain.account.ProductAlert
import com.furkansogutma.domain.account.SiteConfig
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AccountRepositoryImpl @Inject constructor(
    private val api: CommerceApi,
    private val catalogApi: CatalogApi,
    private val safeApiCall: SafeApiCall,
) : AccountRepository {
    override suspend fun getAddresses(): Result<List<Address>> =
        safeApiCall { api.addresses().map { it.toDomain() } }

    override suspend fun createAddress(input: AddressInput): Result<Address> =
        safeApiCall { api.createAddress(input.toDto()).toDomain() }

    override suspend fun updateAddress(id: String, input: AddressInput): Result<Address> =
        safeApiCall { api.updateAddress(id, input.toDto()).toDomain() }

    override suspend fun deleteAddress(id: String): Result<Unit> =
        safeApiCall { api.deleteAddress(id); Unit }

    override suspend fun getAlerts(): Result<List<ProductAlert>> =
        safeApiCall { api.productAlerts().map { it.toDomain() } }

    override suspend fun createAlert(productId: String): Result<Unit> =
        safeApiCall { api.createAlert(productId); Unit }

    override suspend fun deleteAlert(productId: String): Result<Unit> =
        safeApiCall { api.deleteAlert(productId); Unit }

    override suspend fun getCurrentAccount(): Result<CurrentAccount> =
        safeApiCall { api.currentAccount().toDomain() }

    override suspend fun getTransactions(page: Int): Result<List<AccountTransaction>> =
        safeApiCall { api.accountTransactions(page).items.map { it.toDomain() } }

    override suspend fun getBankTransfers(page: Int): Result<List<BankTransfer>> =
        safeApiCall { api.bankTransfers(page).items.map { it.toDomain() } }

    override suspend fun createBankTransfer(
        orderId: String,
        amount: String,
        description: String?,
        bankName: String?,
        transferDate: String?,
    ): Result<BankTransfer> = safeApiCall {
        api.createBankTransfer(
            orderId,
            CreateBankTransferRequestDto(
                senderName = description?.takeIf { it.length >= 2 } ?: "FurkanSoğutma Müşteri",
                transferDate = transferDate ?: java.time.LocalDate.now().toString(),
                referenceNumber = null,
                note = listOfNotNull(bankName, description).joinToString(" · ").ifBlank { null },
                amount = amount.ifBlank { null },
                bankAccountId = null,
            ),
        ).toDomain()
    }

    override suspend fun registerDeviceToken(token: String): Result<Unit> =
        safeApiCall { api.registerDevice(RegisterDeviceRequestDto(token)); Unit }

    override suspend fun unregisterDeviceToken(token: String): Result<Unit> =
        safeApiCall { api.unregisterDevice(token); Unit }

    override suspend fun getSiteConfig(): Result<SiteConfig> =
        safeApiCall { catalogApi.siteConfig().toDomain() }

    override suspend fun getBankAccounts(): Result<List<CompanyBankAccount>> =
        safeApiCall { api.bankAccounts().map { it.toDomain() } }

    private fun AddressInput.toDto() = CreateAddressRequestDto(
        title = title,
        firstName = firstName,
        lastName = lastName,
        phone = phone,
        city = city,
        district = district,
        neighborhood = neighborhood,
        addressLine = addressLine,
        postalCode = postalCode,
        country = country,
        isDefault = isDefault,
    )
}
