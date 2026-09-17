# Coupons

## Model

- `Coupon.code` stored **uppercase**; matching is case-insensitive (`furkan10` = `FURKAN10`)
- Types: `PERCENTAGE`, `FIXED_AMOUNT`
- Limits: `minimumOrderAmount`, `maximumDiscountAmount`, `usageLimit`, `perUserLimit`
- Window: `startsAt` / `endsAt` + `active`

## Validation

`POST /checkout/coupon/validate` (also `/coupon/validate`)

Checks:

1. Code exists
2. Active
3. Date window
4. Minimum order (against cart merchandise total from `PriceService`)
5. Global usage limit
6. Per-user limit
7. Discount &gt; 0 after caps

Client sends **only** `code` (optional preview `orderAmount`). Never send `discountAmount`.

## Apply on order

`CreateOrderDto.couponCode` → backend re-validates → writes:

- `Order.couponId`, `couponCode`, `couponDiscountAmount`
- `CouponUsage` (`@@unique(couponId, orderId)`)

## Discount calculation

- PERCENTAGE: `orderAmount * value / 100`
- FIXED_AMOUNT: `value`
- Cap by `maximumDiscountAmount`
- Never exceed order amount

Example: 20% with max 1000 TRY on 5000 TRY order → **1000 TRY**.

## Admin

`/coupons` — create, activate/deactivate, usage count.
Audit: `COUPON_CREATED`, `COUPON_UPDATED`, `COUPON_ACTIVATED`, `COUPON_DEACTIVATED`.
