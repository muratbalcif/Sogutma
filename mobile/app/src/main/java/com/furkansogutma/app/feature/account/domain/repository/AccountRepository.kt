package com.furkansogutma.app.feature.account.domain.repository

import com.furkansogutma.app.core.common.result.Result
import com.furkansogutma.app.feature.account.domain.model.Address
import com.furkansogutma.app.feature.account.domain.model.AddressInput
import com.furkansogutma.app.feature.account.domain.model.ProductAlert
import com.furkansogutma.app.feature.account.domain.model.CurrentAccount
import com.furkansogutma.app.feature.account.domain.model.AccountTransaction
import com.furkansogutma.app.feature.account.domain.model.BankTransfer
import com.furkansogutma.app.feature.account.domain.model.SiteConfig
import com.furkansogutma.app.feature.account.domain.model.LegalPage
import com.furkansogutma.app.feature.account.domain.model.CompanyBankAccount

interface AccountRepository {
    suspend fun getAddresses(): Result<List<Address>>
    suspend fun createAddress(input: AddressInput): Result<Address>
    suspend fun updateAddress(id: String, input: AddressInput): Result<Address>
    suspend fun deleteAddress(id: String): Result<Unit>
    suspend fun getAlerts(): Result<List<ProductAlert>>
    suspend fun createAlert(productId: String): Result<Unit>
    suspend fun deleteAlert(productId: String): Result<Unit>
    suspend fun getCurrentAccount(): Result<CurrentAccount>
    suspend fun getTransactions(page: Int = 1): Result<List<AccountTransaction>>
    suspend fun getBankTransfers(page: Int = 1): Result<List<BankTransfer>>
    suspend fun createBankTransfer(
        orderId: String,
        bankAccountId: String,
        amount: String? = null,
    ): Result<BankTransfer>
    suspend fun registerDeviceToken(token: String): Result<Unit>
    suspend fun unregisterDeviceToken(token: String): Result<Unit>
    suspend fun getSiteConfig(): Result<SiteConfig>
    suspend fun getLegalPage(slug: String): Result<LegalPage>
    suspend fun getBankAccounts(): Result<List<CompanyBankAccount>>
}
