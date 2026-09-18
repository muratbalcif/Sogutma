package com.furkansogutma.app.feature.account.data.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.core.network.api.CatalogApi
import com.furkansogutma.app.core.network.api.CommerceApi
import com.furkansogutma.app.core.network.dto.CreateAddressRequestDto
import com.furkansogutma.app.core.network.dto.CreateBankTransferRequestDto
import com.furkansogutma.app.core.network.dto.RegisterDeviceRequestDto
import com.furkansogutma.app.data.mapper.toDomain
import com.furkansogutma.app.core.network.SafeApiCall
import com.furkansogutma.app.feature.account.domain.repository.AccountRepository
import com.furkansogutma.app.feature.account.domain.model.AccountTransaction
import com.furkansogutma.app.feature.account.domain.model.Address
import com.furkansogutma.app.feature.account.domain.model.AddressInput
import com.furkansogutma.app.feature.account.domain.model.BankTransfer
import com.furkansogutma.app.feature.account.domain.model.CompanyBankAccount
import com.furkansogutma.app.feature.account.domain.model.CurrentAccount
import com.furkansogutma.app.feature.account.domain.model.LegalPage
import com.furkansogutma.app.feature.account.domain.model.ProductAlert
import com.furkansogutma.app.feature.account.domain.model.SiteConfig
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
        bankAccountId: String,
        amount: String?,
    ): Result<BankTransfer> = safeApiCall {
        api.createBankTransfer(
            orderId,
            CreateBankTransferRequestDto(
                bankAccountId = bankAccountId,
                amount = amount?.ifBlank { null },
            ),
        ).toDomain()
    }

    override suspend fun registerDeviceToken(token: String): Result<Unit> =
        safeApiCall { api.registerDevice(RegisterDeviceRequestDto(token)); Unit }

    override suspend fun unregisterDeviceToken(token: String): Result<Unit> =
        safeApiCall { api.unregisterDevice(token); Unit }

    override suspend fun getSiteConfig(): Result<SiteConfig> =
        safeApiCall { catalogApi.siteConfig().toDomain() }

    override suspend fun getLegalPage(slug: String): Result<LegalPage> =
        safeApiCall { catalogApi.legalPage(slug).toDomain() }

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
