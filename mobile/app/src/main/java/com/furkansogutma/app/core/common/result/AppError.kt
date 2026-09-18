package com.furkansogutma.app.core.common.result

sealed class AppError(open val message: String) {
    data class Network(override val message: String = "Sunucuya bağlanılamadı. Lütfen tekrar deneyin.") : AppError(message)
    data class Unauthorized(override val message: String = "Oturumunuz sona erdi. Lütfen tekrar giriş yapın.") : AppError(message)
    data class Forbidden(override val message: String = "Bu işlem için yetkiniz yok.") : AppError(message)
    data class NotFound(override val message: String = "İstenen içerik bulunamadı.") : AppError(message)
    data class Validation(override val message: String) : AppError(message)
    data class Server(override val message: String = "Sunucu hatası oluştu. Lütfen daha sonra deneyin.") : AppError(message)
    data class Unknown(override val message: String = "Beklenmeyen bir hata oluştu.") : AppError(message)
}
