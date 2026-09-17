package com.furkansogutma.data.mapper

import com.furkansogutma.core.network.dto.AccountCurrentDto
import com.furkansogutma.core.network.dto.AccountTransactionDto
import com.furkansogutma.core.network.dto.AddressDto
import com.furkansogutma.core.network.dto.AuthTokensDto
import com.furkansogutma.core.network.dto.BannerDto
import com.furkansogutma.core.network.dto.BankTransferDto
import com.furkansogutma.core.network.dto.BrandDto
import com.furkansogutma.core.network.dto.CampaignDto
import com.furkansogutma.core.network.dto.CampaignProductDto
import com.furkansogutma.core.network.dto.CartDto
import com.furkansogutma.core.network.dto.CartValidationDto
import com.furkansogutma.core.network.dto.CategoryDto
import com.furkansogutma.core.network.dto.CheckoutValidationDto
import com.furkansogutma.core.network.dto.CompanyBankAccountDto
import com.furkansogutma.core.network.dto.NotificationDto
import com.furkansogutma.core.network.dto.NotificationPreferenceDto
import com.furkansogutma.core.network.dto.OrderDto
import com.furkansogutma.core.network.dto.ProductAlertDto
import com.furkansogutma.core.network.dto.ProductDto
import com.furkansogutma.core.network.dto.SiteConfigDto
import com.furkansogutma.core.network.dto.UnreadCountDto
import com.furkansogutma.core.network.dto.UserDto
import com.furkansogutma.domain.account.AccountTransaction
import com.furkansogutma.domain.account.Address
import com.furkansogutma.domain.account.BankTransfer
import com.furkansogutma.domain.account.CompanyBankAccount
import com.furkansogutma.domain.account.CurrentAccount
import com.furkansogutma.domain.account.ProductAlert
import com.furkansogutma.domain.account.SiteConfig
import com.furkansogutma.domain.auth.AuthSession
import com.furkansogutma.domain.auth.AuthUser
import com.furkansogutma.domain.cart.Cart
import com.furkansogutma.domain.cart.CartIssue
import com.furkansogutma.domain.cart.CartItem
import com.furkansogutma.domain.cart.CartValidation
import com.furkansogutma.domain.category.Category
import com.furkansogutma.domain.notification.AppNotification
import com.furkansogutma.domain.notification.NotificationPreferences
import com.furkansogutma.domain.notification.UnreadCount
import com.furkansogutma.domain.order.CheckoutIssue
import com.furkansogutma.domain.order.CheckoutValidation
import com.furkansogutma.domain.order.Order
import com.furkansogutma.domain.order.OrderItem
import com.furkansogutma.domain.order.OrderShipping
import com.furkansogutma.domain.order.OrderStatusHistory
import com.furkansogutma.domain.product.Banner
import com.furkansogutma.domain.product.Brand
import com.furkansogutma.domain.product.Campaign
import com.furkansogutma.domain.product.CampaignProduct
import com.furkansogutma.domain.product.Money
import com.furkansogutma.domain.product.Product
import com.furkansogutma.domain.product.ProductAttribute
import com.furkansogutma.domain.product.ProductCompatibility
import com.furkansogutma.domain.product.ProductImage

fun UserDto.toDomain() = AuthUser(
    id = id,
    email = email,
    firstName = firstName,
    lastName = lastName,
    phone = phone,
    userType = userType,
    status = status,
)

fun AuthTokensDto.toDomain() = AuthSession(
    user = user.toDomain(),
    accessToken = accessToken,
    refreshToken = refreshToken,
)

fun ProductDto.toDomain() = Product(
    id = id,
    sku = sku,
    barcode = barcode,
    name = name,
    slug = slug,
    description = description,
    brandName = brand.name,
    brandSlug = brand.slug,
    categoryName = category.name,
    categorySlug = category.slug,
    images = images.map { ProductImage(it.id, it.url, it.alt, it.isPrimary) },
    price = price?.let { Money(it.amount, it.currency, it.type) },
    compareAtPrice = compareAtPrice?.let { Money(it.amount, it.currency, it.type) },
    stockAvailable = stock?.available == true,
    stockQuantity = stock?.quantity ?: 0,
    onCampaign = onCampaign == true,
    attributes = attributes.orEmpty().map { ProductAttribute(it.name, it.value) },
    compatibility = compatibility.orEmpty().map {
        ProductCompatibility(it.manufacturer, it.model, it.modelYear, it.notes)
    },
)

fun CategoryDto.toDomain(): Category = Category(
    id = id,
    name = name,
    slug = slug,
    description = description,
    parentId = parentId,
    children = children.orEmpty().map { it.toDomain() },
)

fun BannerDto.toDomain() = Banner(id, title, subtitle, imageUrl, linkType, linkValue)
fun BrandDto.toDomain() = Brand(id, name, slug, logo)

fun CampaignDto.toDomain() = Campaign(
    id = id,
    name = name,
    slug = slug,
    description = description,
    type = type,
    active = active,
    priority = priority,
    startsAt = startsAt,
    endsAt = endsAt,
    status = status,
)

fun CampaignProductDto.toDomain() = CampaignProduct(
    id = id,
    productId = productId,
    name = product?.name.orEmpty(),
    slug = product?.slug.orEmpty(),
    sku = product?.sku.orEmpty(),
    discountPercentage = discountPercentage,
    discountAmount = discountAmount,
    specialPrice = specialPrice,
)

fun CartDto.toDomain() = Cart(
    id = id,
    items = items.map {
        CartItem(
            productId = it.product.id,
            quantity = it.quantity,
            name = it.product.name,
            slug = it.product.slug,
            sku = it.product.sku,
            imageUrl = it.product.images.firstOrNull { img -> img.isPrimary }?.url
                ?: it.product.images.firstOrNull()?.url,
            unitPrice = it.unitPrice,
            lineTotal = it.subtotal,
            currency = it.currency ?: summary.currency,
            available = it.available,
            availableQuantity = it.availableQuantity,
            issueCode = it.issueCode,
        )
    },
    subtotal = summary.subtotal,
    discountAmount = summary.discount,
    total = summary.total,
    currency = summary.currency,
)

fun CartValidationDto.toDomain() = CartValidation(
    valid = valid,
    issues = issues.map { CartIssue(it.productId, it.code, it.message) },
)

fun CheckoutValidationDto.toDomain() = CheckoutValidation(
    valid = valid,
    issues = issues.map { CheckoutIssue(it.code, it.message, it.productId) },
    total = summary?.total,
    currency = summary?.currency,
)

fun OrderDto.toDomain() = Order(
    id = id,
    orderNumber = orderNumber,
    status = status,
    paymentStatus = payment?.status,
    paymentMethod = payment?.method,
    total = totalAmount,
    subtotal = subtotal,
    taxAmount = taxAmount,
    discountAmount = discountAmount,
    shippingAmount = shippingAmount,
    currency = currency,
    createdAt = createdAt,
    items = items.map {
        OrderItem(it.id, it.productId, it.productName, it.sku, it.quantity, it.unitPrice, it.totalAmount)
    },
    statusHistory = statusHistory.map {
        OrderStatusHistory(it.id, it.toStatus, it.note, it.createdAt)
    },
    shippingSummary = shippingAddress?.let {
        "${it.firstName} ${it.lastName}, ${it.addressLine}, ${it.district}/${it.city}"
    },
    shipping = shipping?.let {
        OrderShipping(
            provider = it.provider,
            trackingNumber = it.trackingNumber,
            trackingUrl = it.trackingUrl,
            status = it.status,
        )
    },
    canCancel = canCancel,
)

fun NotificationDto.toDomain() = AppNotification(
    id = id,
    type = type,
    title = title,
    body = body.ifBlank { message.orEmpty() },
    entityType = entityType,
    entityId = entityId,
    productSlug = data?.productSlug ?: data?.slug,
    orderId = data?.orderId
        ?: entityId?.takeIf {
            entityType.equals("ORDER", ignoreCase = true) ||
                entityType.equals("PAYMENT", ignoreCase = true)
        },
    readAt = readAt,
    createdAt = createdAt,
)

fun UnreadCountDto.toDomain() = UnreadCount(count)

fun NotificationPreferenceDto.toDomain() = NotificationPreferences(
    orderNotifications = orderNotifications,
    paymentNotifications = paymentNotifications,
    stockAlerts = stockAlerts,
    campaignNotifications = campaignNotifications,
    systemNotifications = systemNotifications,
)

fun NotificationPreferences.toDto() = NotificationPreferenceDto(
    orderNotifications = orderNotifications,
    paymentNotifications = paymentNotifications,
    stockAlerts = stockAlerts,
    campaignNotifications = campaignNotifications,
    systemNotifications = systemNotifications,
)

fun AddressDto.toDomain() = Address(
    id, title, firstName, lastName, phone, city, district, neighborhood,
    addressLine, postalCode, country, isDefault,
)

fun ProductAlertDto.toDomain() = ProductAlert(
    id, productId, product?.name, product?.slug, status, createdAt,
)

fun AccountCurrentDto.toDomain() = CurrentAccount(
    balance = balance,
    debit = totalDebit ?: debit,
    credit = totalCredit ?: credit,
    currency = currency,
)
fun AccountTransactionDto.toDomain() = AccountTransaction(id, type, amount, balanceAfter, description, createdAt)
fun BankTransferDto.toDomain() = BankTransfer(id, orderId, amount, transferDate, description, status, bankName, senderName)
fun SiteConfigDto.toDomain() = SiteConfig(
    siteName, supportEmail, supportPhone, address,
    bankTransferInfo.bankName, bankTransferInfo.iban, bankTransferInfo.accountName,
)

fun CompanyBankAccountDto.toDomain() = CompanyBankAccount(
    id = id,
    bankName = bankName,
    accountName = accountName,
    iban = iban,
    branch = branch,
    currency = currency,
    description = description,
)
