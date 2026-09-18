-- One SALE inventory movement per product per order (idempotent fulfillment commit).
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_transactions_order_sale_uidx"
ON "inventory_transactions" ("productId", "referenceId")
WHERE "type" = 'SALE'
  AND "referenceType" = 'ORDER'
  AND "referenceId" IS NOT NULL;
