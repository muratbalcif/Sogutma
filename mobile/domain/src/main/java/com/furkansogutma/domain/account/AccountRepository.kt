package com.furkansogutma.domain.account

import com.furkansogutma.core.common.result.Result

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
        amount: String,
        description: String?,
        bankName: String?,
        transferDate: String?,
    ): Result<BankTransfer>
    suspend fun registerDeviceToken(token: String): Result<Unit>
    suspend fun unregisterDeviceToken(token: String): Result<Unit>
    suspend fun getSiteConfig(): Result<SiteConfig>
    suspend fun getBankAccounts(): Result<List<CompanyBankAccount>>
}
