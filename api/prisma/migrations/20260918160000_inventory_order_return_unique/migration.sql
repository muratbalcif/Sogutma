-- One RETURN inventory movement per product per order (idempotent return restock).
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_transactions_order_return_uidx"
ON "inventory_transactions" ("productId", "referenceId")
WHERE "type" = 'RETURN'
  AND "referenceType" = 'ORDER'
  AND "referenceId" IS NOT NULL;
