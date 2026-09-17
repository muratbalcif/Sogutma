# Pricing

Central price resolution lives in `PriceService.resolvePrice` (API).  
Web, Android, cart, checkout, and orders **must display this result only** — never recompute discounts on the client.

## Priority (deterministic)

1. **Customer-specific** (`CustomerPrice`)
2. **Corporate** (`ProductPrice` CORPORATE) — `userType=CORPORATE` only
3. **Wholesale** (`ProductPrice` WHOLESALE) — corporate users only
4. **Campaign** — Campaign module offer and/or legacy `ProductPrice` CAMPAIGN; **lower amount wins**
5. **Retail** (`ProductPrice` RETAIL)

## Resolved price payload

```
amount / finalPrice
basePrice
discountAmount
discountPercentage
priceType (CUSTOMER | CORPORATE | WHOLESALE | CAMPAIGN | RETAIL)
campaignId (when module campaign wins)
currency
validUntil
```

## Customer price

- Admin: `/admin/pricing/customers/:customerId`
- Overlapping active windows for the same customer+product are rejected
- Always wins over campaigns

## Corporate / wholesale

Driven by backend `User.userType`, not client claims.

## Security

Client must not send `price`, `discountAmount`, `campaignId`, or computed totals for authority.  
Order create accepts: addresses, note, optional `couponCode` only.

See also: [campaigns.md](./campaigns.md), [coupons.md](./coupons.md), [pricing-campaigns.md](./pricing-campaigns.md).
